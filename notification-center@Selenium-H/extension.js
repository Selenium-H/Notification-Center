// Version 16

const Config = imports.misc.config;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Meta = imports.gi.Meta;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const _ = imports.gettext.domain("notification-center").gettext;

let notificationCenter = null;

function enable() {
  Main.panel.statusArea.dateMenu.menu.open();
  Main.panel.statusArea.dateMenu.menu.close();
  notificationCenter = new NotificationCenter();
  notificationCenter.startNotificationCenter();
  reloadExtensionOnPrefsChange();
}

function disable() {
  notificationCenter.undoChanges();  
  notificationCenter.destroy();
}

function reloadExtensionOnPrefsChange() {
  // Reloads the Extension when preferences are changed.
  notificationCenter.prefs.connect("changed::reload-signal", () => {
    disable();
    enable();
  });
}

const NotificationCenter = new Lang.Class({
  Name: "NotificationCenter",
  Extends: PanelMenu.Button,

  _init: function () {
    Convenience.initTranslations("notification-center");
    this.prefs = Convenience.getSettings("org.gnome.shell.extensions.notification-center");
    this.dndpref = new Gio.Settings({schema_id:'org.gnome.desktop.notifications'});
    this.parent(1-0.5*this.prefs.get_enum('indicator-pos'), "NotificationCenter");
    this.loadPreferences();
    
    this.connectedSignals = [];
    this.showingSections = [];
    this.prefSignals = [];
    this.dmsig = null;
    this._loopTimeoutId = null;
    this.notificationCount = 0;
    this.eventsCount = 0;
    this.rightClick = false;
    
    this.eventsIcon = new St.Icon({style_class:'system-status-icon'});
    this.eventsLabel = new St.Label({ text: '',visible:false});
    this.mediaIcon = new St.Icon({style_class:'system-status-icon'});
    this.notificationIcon = new St.Icon({style_class:'system-status-icon'});
    this.notificationLabel = new St.Label({ text: '',visible:false});

    this._indicator =  new St.BoxLayout({ vertical: false, style_class: 'panel-status-menu-box',style:"spacing:0.0em"});

    this._messageList = Main.panel.statusArea.dateMenu._messageList;
    this.box  = new St.BoxLayout({style_class:'calendar',vertical: true,pack_start:false});
    this.clearButton = new St.Button({style_class: 'message-list-clear-button button',label: _("Clear All"),can_focus: true});
    this.scrollView = new St.ScrollView({hscrollbar_policy:2,x_fill:true,y_fill:true,style:"min-width:"+this._messageList.actor.width+"px;max-height: "+0.01*this.prefs.get_int("max-height")*Main.layoutManager.monitors[0].height+"px; max-width:"+this._messageList.actor.width+"px; padding: 0px;"});
    this.dnditem = new PopupMenu.PopupSwitchMenuItem(_("Do Not Disturb")); 
  },

  addClearButton: function() {
    if(this.prefs.get_enum("clear-button-alignment")==3){
      return;
    }

    let box = new St.BoxLayout({ style:"min-width:"+this._messageList.actor.width+"px; padding-bottom:0px",vertical: true});
    box._delegate = this;
    this.clearButton.set_x_align(1+this.prefs.get_enum('clear-button-alignment'));
    this.clearButton.connect('clicked',()=> {
      let len=this.showingSections.length;
      while(len!=0) {
          this.showingSections[len-1].clear();
          len--;
      }
      this.clearButton.hide();
    });
    
    box.add(this.clearButton);
    this.menu.box.add_child(box);
  },

  addThisSection:function(section,KEY,fNo) {
    if(this.prefs.get_boolean(KEY)) {
      this.addSectionToThis(section);
      this.connectedSignals.push(section._list.connect('actor-added'   ,()=> this.newNotif(fNo) ))
      this.connectedSignals.push(section._list.connect('actor-removed' ,()=> this.remNotif(fNo) ));
      this.showingSections.push(section);   
    }
  },

  addSectionToThis: function (section) {
      this._messageList._removeSection(section);
      this.box.add(section.actor);
  },

  blinkIcon: function() {
    if(this.prefs.get_boolean("blink-icon") && this.dndpref.get_boolean("show-banners")){
      if(this._loopTimeoutId!=null) {
        Mainloop.source_remove(this._loopTimeoutId);
      }
      this.notificationIcon.set_opacity((this.notificationIcon.get_opacity()==255)? 100 : 255);
      this._loopTimeoutId=Mainloop.timeout_add(this.prefs.get_int('blink-time'), Lang.bind(this, this.blinkIcon));
    }
  },

  dndToggle: function() {
    (this.dndpref.get_boolean('show-banners')==true) ? this.dndpref.set_boolean('show-banners',false):this.dndpref.set_boolean('show-banners',true);
  },

  filterNotifications: function() {
    let source = Main.messageTray.getSources()[Main.messageTray.getSources().length-1];
    if (this.prefs.get_strv("name-list").indexOf(source.title)>=0) {
      switch(this.prefs.get_enum("for-list")) {
          case 0:
            break ;
          case 1:
            source.policy = new Main.MessageTray.NotificationPolicy({showBanners:false});
            return;
          case 3:
            source.policy = new Main.MessageTray.NotificationPolicy({showBanners:false});
          case 2:
            this.notificationCount--;
            return ;
      }
    }
    this.blinkIcon();
  },

  indicatorViewShortcut : function() {
    Main.wm.addKeybinding(
      'indicator-shortcut',
      this.prefs,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
      () => { (this.actor.visible==true) ? this.actor.hide() : this.manageAutohide(true); }
    );
  },

  loadDndStatus: function () {
    this.notificationIcon.icon_name = Gtk.IconTheme.get_default().has_icon("notification-symbolic")?"notification-symbolic":"preferences-system-notifications-symbolic";
    this.eventsIcon.icon_name = "x-office-calendar-symbolic";
    this.mediaIcon.icon_name = "audio-x-generic-symbolic";
    
    if(this.dndpref.get_boolean("show-banners")) {
      this.dnditem.setToggleState(false);
      this.notificationIcon.set_opacity(255);
      Main.messageTray._bannerBin.show();
      return false;
    }
    
    this.dnditem.setToggleState(true); 
    this.notificationIcon.set_opacity(150);
    this.notificationLabel.hide();
    this.eventsLabel.hide();
    Main.messageTray._bannerBin.hide();
    return true;
  },
  
  loadPreferences: function() {
    this.autohide = this.prefs.get_boolean("autohide");
    this.showMediaSection = this.prefs.get_boolean("show-media");
    this.showNotificationSection = this.prefs.get_boolean("show-notifications");
    this.showEventsSection = this.prefs.get_boolean("show-events");
    this.showEventsInCalendar=(this.showEventsSection)?this.prefs.get_boolean("show-events-in-calendar"): false;
    this.showThreeIcons = this.prefs.get_boolean("individual-icons");
    this.includeEventsCount=this.prefs.get_boolean("include-events-count");
    this.newNotificationAction=this.prefs.get_enum("new-notification"); 
  },

  manageAutohide: function(iconState=false) {
    if(this.menu.isOpen) {
      return;
    }
    
    this.notificationIcon.hide();
    this.eventsIcon.hide();
    this.mediaIcon.hide(); 
    this.clearButton.hide();
    
    if(this.showNotificationSection) {
      if(this._messageList._notificationSection._canClear()) {
        this.actor.show();
        this.notificationIcon.show();     
        this.clearButton.show();
        if(this.showThreeIcons == false) {
          return;
        }
      }
    }
    
    if(this.showEventsSection) {
      if(Config.PACKAGE_VERSION < "3.32.0") { // For Shell Version 3.32 and beyond
        if(this._messageList._eventsSection._canClear()) {
          this.actor.show();
          this.clearButton.show();
          if(this.showThreeIcons == false) {
            this.notificationIcon.show();
            return;
          }
          this.eventsIcon.show();
        }
      }
      else{  // For Shell Version 3.32 and beyond
        this._messageList._eventsSection._reloadEvents(); 
        if(this._messageList._eventsSection._shouldShow()) {
          this.actor.show(); 
          if(this.showThreeIcons == false) {
            this.notificationIcon.show();
            return;
          }
          this.eventsIcon.show();
        }
      }
    }
    
    if(this.showMediaSection) {
      if(this._messageList._mediaSection._shouldShow()) {
        this.actor.show(); 
        if(this.showThreeIcons == false) {
          this.notificationIcon.show();
          return;
        }
        this.mediaIcon.show();
      }
    }
    
    if(this.eventsIcon.visible==true||this.mediaIcon.visible==true || this.notificationIcon.visible==true ) {
      return;
    }
    if(this.autohide==false||iconState==true) {
      this.notificationIcon.show();
      this.actor.show();
      return;
    }
    else {
      this.actor.hide();
    }
  },

  manageEvents: function(action) {
    if(this.showEventsInCalendar == true) {
      switch(action) {
        case 0:
          this._messageList._removeSection(this._messageList._eventsSection); 
          this.box.add(this._messageList._eventsSection.actor);  
          return;
        case 1: 
       	  this.box.remove_child(this.box.get_children()[this.showingSections.length-1]);
       	  this._messageList._addSection(this._messageList._eventsSection);
          return;
      }
    }
  },
  
  manageLabel:function(nCount,eCount) {  
    switch(this.newNotificationAction) {
      case 1  : 
        if(nCount>0) {
          this.notificationLabel.show();
          this.notificationLabel.text="• ";      
        }
        if(eCount > 0) {   
          this.eventsLabel.show(); 
          this.eventsLabel.text="• ";      
        }
        return;
      case 2  :
        if(nCount>0) {
          this.notificationLabel.show();
          this.notificationLabel.text=nCount.toString()+" ";      
        }
        if(eCount > 0 ) {   
          this.eventsLabel.show(); 
          this.eventsLabel.text=eCount.toString()+" ";      
        }
        return;
      default :   
        this.notificationLabel.hide();            
        this.eventsLabel.hide();            
        return;
    }
  },
    
  middleClickDndToggle: function (actor, event) {
    let button = event.get_button();

    if(button == 1) {
      if (this.menu.isOpen) {
        this._messageList.setDate(new Date());
        if(this._loopTimeoutId!=null) { 
          Mainloop.source_remove(this._loopTimeoutId); 
          this._loopTimeoutId=null;
        }    
        if(this.prefs.get_boolean("show-label")==false) { 
          this.notificationCount=0;
          this.eventsCount=0;
        }
        this.rightClick = true;
        this.resetIndicator();
      }
      return;
    }

    if(button == 3) {
    
      if(this.rightClick) {
        return;
      }

      this.removeAndDisconnectSections();
      this.showEventsInCalendar = false;
      Main.panel.statusArea.dateMenu.menu.open();
      Main.panel.statusArea.dateMenu.menu.close();
      this.showEventsInCalendar=(this.showEventsSection)?this.prefs.get_boolean("show-events-in-calendar"): false; 
      this.rebuildMessageList();
      this.menu.close()
      this.menu.open();
      this.rightClick = true;
      return ;
    }

    // if middle click
    if (button == 2) {
      // close the menu, since it gets open on any click
      if (this.menu.isOpen) {
        this.menu.actor.hide();
      }
      // toggle DND state
      this.dndToggle();
      // reload dnd status
      this.loadDndStatus();
    };
  },

  newNotif: function(fNo) {
    switch(fNo) {
      case 1 : 
        this.notificationCount++; 
        this.filterNotifications();
        break;
      case 2 :
        this.eventsCount++;
        break;
    }
    this.resetIndicator();
  },

  rebuildMessageList: function() {
    this.addThisSection(this._messageList._mediaSection        ,"show-media"         ,0);
    this.addThisSection(this._messageList._notificationSection ,"show-notifications" ,1);
    this.addThisSection(this._messageList._eventsSection       ,"show-events"        ,2);
    this.manageEvents(1);
  },

  remNotif: function(fNo) {
    switch(fNo) {
      case 1 : 
        this.notificationCount--; 
        break;
      case 2 :
        this.eventsCount--;
        break;
    }
    this.resetIndicator();
  },

  removeAndDisconnectSections : function() {
    
    let len=this.showingSections.length;
    
    while(len!=0) {
      this.showingSections[len-1]._list.disconnect(this.connectedSignals[2*len-1]);
      this.showingSections[len-1]._list.disconnect(this.connectedSignals[2*len-2]);
      this.removeSectionFromThis(len-1);
      this.connectedSignals.pop();
      this.connectedSignals.pop(); 
      this.showingSections.pop(); 
      len--;
    }
  },

  removeDotFromDateMenu: function() {
    Main.panel.statusArea.dateMenu.actor.get_children()[0].remove_actor(Main.panel.statusArea.dateMenu._indicator.actor);  
    this.dtActors=Main.panel.statusArea.dateMenu.actor.get_children()[0].get_children();
    Main.panel.statusArea.dateMenu.actor.get_children()[0].remove_actor(this.dtActors[0]);
  },

  removeSectionFromThis : function(len) {
    this.box.remove_child(this.box.get_children()[len]);
    this._messageList._addSection(this.showingSections[len]);
  },
  
  resetIndicator: function() {
    this.manageAutohide();
        
    if(this.includeEventsCount==false) {
      this.eventsCount=0;
    }
    
    if( this.loadDndStatus() == false ) {
      if(this.includeEventsCount==true && this.showThreeIcons == false) {
        this.manageLabel(this.notificationCount+this.eventsCount,0); 
      }
      else {
        this.manageLabel(this.notificationCount,this.eventsCount); 
      }        
    }

    if(this.notificationCount+this.eventsCount<=0) {
      this.notificationLabel.hide();
      this.eventsLabel.hide();
      this.notificationCount=0;
      this.eventsCount=0;
      if(this._loopTimeoutId!=null) { 
        Mainloop.source_remove(this._loopTimeoutId); 
        this._loopTimeoutId=null;
      }		
    }
  },

  seen: function() {
    if (!this.menu.isOpen) {
      this.manageEvents(1);
      this.resetIndicator();
      return ;
    }
    this.manageEvents(0);
    this.rightClick = false;
  },

  startNotificationCenter: function() {
    this._indicator.add_child(this.eventsIcon);
    this._indicator.add_child(this.eventsLabel);
    this._indicator.add_child(this.mediaIcon);
    this._indicator.add_child(this.notificationIcon);
    this._indicator.add_child(this.notificationLabel);
    this.actor.add_child(this._indicator);
    Main.panel.addToStatusArea("NotificationCenter", this, 2, this.prefs.get_string('indicator-pos'));
    this.rebuildMessageList();    
    
    this.scrollView.add_actor(this.box);
    this.scrollView._delegate = this;
    
    switch(this.prefs.get_enum("dnd-position")){
      case 1 : 
        this.menu.addMenuItem(this.dnditem); 
      case 0 : 
        this.menu.box.add_child(this.scrollView);
        this.addClearButton();              
        break;
      default: 
        this.menu.box.add_child(this.scrollView);
        this.addClearButton();
        this.menu.addMenuItem(new PopupMenu.PopupBaseMenuItem({reactive:false})); 
        this.menu.addMenuItem(this.dnditem); 
        break;
    }
        
    Main.messageTray._bannerBin.x = (this.prefs.get_enum('banner-pos')-1)*(Main.layoutManager.monitors[0].width-(Main.messageTray._bannerBin.width=this.scrollView.width));
    this.removeDotFromDateMenu();
    this.resetIndicator();
    
    this.indicatorViewShortcut();
    this.menu.connect("open-state-changed",()=>this.seen());
    this.dnditem.connect("toggled", ()=>this.dndToggle());
    if(this.prefs.get_boolean("middle-click-dnd")) {
      this.actor.connect("button-press-event", (actor, event)=>this.middleClickDndToggle(actor, event));
    }
    if(this.showEventsSection) {
      this.dmSig=Main.panel.statusArea.dateMenu.menu.connect("open-state-changed",()=> {
        if(!Main.panel.statusArea.dateMenu.menu.isOpen) {
          this._messageList.setDate(new Date());
        }
        if(this.prefs.get_boolean("show-label")==false && this.showEventsInCalendar == true) { 
          this.eventsCount=0;
        } 
        this.resetIndicator();
      });
    }
  },

  undoChanges: function () {
    if(this._loopTimeoutId!=null) { 
      Mainloop.source_remove(this._loopTimeoutId); 
      this._loopTimeoutId=null;
    }    

    this.manageEvents(0);
    this.removeAndDisconnectSections();

    this._messageList._removeSection(this._messageList._mediaSection);
    this._messageList._removeSection(this._messageList._notificationSection);
    this._messageList._removeSection(this._messageList._eventsSection);
    this._messageList._addSection(this._messageList._mediaSection);
    this._messageList._addSection(this._messageList._notificationSection);
    this._messageList._addSection(this._messageList._eventsSection);
    Main.messageTray._bannerBin.show();
    Main.messageTray._bannerBin.x=0;
    
    if(this.dmSig!= null) {
      Main.panel.statusArea.dateMenu.menu.disconnect(this.dmSig);
    }

    for(let i=1;i<this.dtActors.length;i++) {
      Main.panel.statusArea.dateMenu.actor.get_children()[0].remove_actor(this.dtActors[i]);
    }
    
    for(let i=0;i<this.dtActors.length;i++) {
      Main.panel.statusArea.dateMenu.actor.get_children()[0].add_actor(this.dtActors[i]);
    }
    
    Main.wm.removeKeybinding('indicator-shortcut');  
    Main.panel.statusArea.dateMenu.actor.get_children()[0].add_actor(Main.panel.statusArea.dateMenu._indicator.actor);
  },
});
