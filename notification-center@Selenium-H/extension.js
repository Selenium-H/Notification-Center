/*
Version 17
==========
 
*/

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
    this.dndpref = new Gio.Settings({schema_id:"org.gnome.desktop.notifications"});
    this.parent(1-0.5*this.prefs.get_enum('indicator-pos'), "NotificationCenter");
    this.loadPreferences();
    
    this.connectedSignals = [];
    this.showingSections = [];
    this.dmsig = null;
    this.cmsig = null;
    this._loopTimeoutId = null;

    this.notificationCount = 0;
    this.eventsCount = 0;
    this.mediaCount = 0;

    this.rightClick = false; 
    
    this.eventsIcon = new St.Icon({icon_name: "x-office-calendar-symbolic",style_class:'system-status-icon',visible:false});
    this.eventsLabel = new St.Label({ text: "• ",visible:false});
    this.mediaIcon = new St.Icon({icon_name : "audio-x-generic-symbolic",style_class:'system-status-icon',visible:false});
    this.notificationIcon = new St.Icon({style_class:'system-status-icon',visible:false});
    this.notificationLabel = new St.Label({ text: "• ",visible:false});
    this._indicator =  new St.BoxLayout({ vertical: false, style_class: 'panel-status-menu-box',style:"spacing:0.0em"});
    this.actor.hide();

    this._messageList = Main.panel.statusArea.dateMenu._messageList;
    
    this.mediaSection = this._messageList._mediaSection;
    this.notificationSection = this._messageList._notificationSection;
    this.eventsSection = this._messageList._eventsSection;


    this.box  = new St.BoxLayout({style_class:'calendar',vertical: true,pack_start:false});
    this.clearButton = new St.Button({style_class: 'message-list-clear-button button',label: _("Clear All"),can_focus: true,visible:false});
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

  addThisSection:function(section,toBeAdded,messageType) {

    if(toBeAdded) {
      this.addSectionToThis(section);
      this.connectedSignals.push(section._list.connect('actor-added'   ,()=> this.newNotif(messageType) ));
      this.connectedSignals.push(section._list.connect('actor-removed' ,()=> this.remNotif(messageType) ));
      this.showingSections.push(section);   
    }
  },

  addSectionToThis: function (section) {

      this._messageList._removeSection(section);
      this.box.add(section.actor);
  },

  autoCloseMenu : function() {

    if (global.display.focus_window!= null && this.menu.isOpen) {
        this.menu.close();
    }
  },

  blinkIcon: function(blinkTimes,interval) {
  
    if(this._loopTimeoutId!=null) {
      Mainloop.source_remove(this._loopTimeoutId);
    }

    if(blinkTimes < 0) {
      this._loopTimeoutId=null; 
      this.loadDndStatus();   
      return;      
    }
    
    if(this.dndpref.get_boolean("show-banners")){
      this.notificationIcon.set_opacity((this.notificationIcon.get_opacity()==255)? 100 : 255);
      this._loopTimeoutId=Mainloop.timeout_add(interval, ()=> this.blinkIcon(--blinkTimes,interval));
    }
  },

  blinkIconStop: function() {
  
    if(this._loopTimeoutId!=null) {
      Mainloop.source_remove(this._loopTimeoutId);
      this._loopTimeoutId=null; 
    }
    
    this.loadDndStatus();
  
  },
    
  dndToggle: function() {

    this.dndpref.set_boolean('show-banners',!this.dndpref.get_boolean('show-banners'));
    
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
    this.blinkIcon(2*this.prefs.get_int("blink-icon"),this.prefs.get_int("blink-time"));
  },

  indicatorViewShortcut : function() {

    Main.wm.addKeybinding(
      'indicator-shortcut',
      this.prefs,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
      () => { 
        this.notificationIcon.visible = !(this.mediaIcon.visible && this.eventsIcon.visible);
        this.actor.visible=!this.actor.visible;
      }
    );
  },

  loadDndStatus: function () {

    this.notificationIcon.icon_name = Gtk.IconTheme.get_default().has_icon("notification-symbolic")?"notification-symbolic":"preferences-system-notifications-symbolic";
    
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
    this.mediaSectionToBeShown = (this.prefs.get_int("show-media")>0)?true:false;
    this.notificationSectionToBeShown = (this.prefs.get_int("show-notification")>0)?true:false;
    this.eventsSectionToBeShown = (this.prefs.get_int("show-events")>0)?true:false;
    this.showEventsInCalendar=(this.eventsSectionToBeShown)?this.prefs.get_boolean("show-events-in-calendar"): false;
    this.showThreeIcons = this.prefs.get_boolean("individual-icons");
    this.includeEventsCount=this.prefs.get_boolean("include-events-count");
    this.newNotificationAction=this.prefs.get_enum("new-notification"); 
    this.menuAutoclose = this.prefs.get_boolean("autoclose-menu");
    this.eventsSectionhere = this.showEventsInCalendar;
    this.orderOfSections = this.prefs.get_strv("sections-order");

  },

  manageAutohide: function(iconState=false) {

    if(this.menu.isOpen) {
      return;
    }

    this.mediaIcon.visible = this.mediaSection._shouldShow() && this.showThreeIcons && this.mediaSectionToBeShown;

    if(this.eventsSectionToBeShown) {
      if( Config.PACKAGE_VERSION >= "3.32.0" ) {
        this.eventsSection._reloadEvents();
        this.eventsIcon.visible = this.eventsSection._shouldShow() && this.showThreeIcons;
        this.notificationIcon.visible = (this.notificationSection._canClear() && this.notificationSectionToBeShown) || 
                                        ((this.mediaSection._shouldShow() && this.mediaSectionToBeShown) || this.eventsSection._shouldShow()) && !this.showThreeIcons ;  
      }
      else {
        this.eventsIcon.visible = (this.eventsSection._canClear()) && this.showThreeIcons;  
        this.notificationIcon.visible = (this.notificationSection._canClear() && this.notificationSectionToBeShown) || 
                                        ((this.mediaSection._shouldShow() && this.mediaSectionToBeShown) || this.eventsSection._canClear()) && !this.showThreeIcons ;  
      }
    }
    else {
      this.eventsIcon.visible = false;
      this.notificationIcon.visible = (this.notificationSection._canClear() && this.notificationSectionToBeShown) || 
                                      (this.mediaSection._shouldShow() && this.mediaSectionToBeShown && !this.showThreeIcons) ;
    }
    
    this.actor.visible = (this.mediaIcon.visible || this.eventsIcon.visible || this.notificationIcon.visible || !this.autohide);
    if(this.actor.visible && (this.mediaIcon.visible || this.eventsIcon.visible || this.notificationIcon.visible) == false ) {
        this.notificationIcon.visible = true;
    }
  },

  manageClearButtonVisibility: function() {
  
    if(!this.menu.isOpen) {
      return;
    }

    if(Config.PACKAGE_VERSION >= "3.32.0") {
      this.clearButton.visible = this.notificationSection._canClear() && this.notificationSectionToBeShown;
      return;
    }

    this.clearButton.visible = (this.eventsSection._canClear()&&this.eventsSectionToBeShown)||(this.notificationSection._canClear()&&this.notificationSectionToBeShown)
    
  },

  manageEvents: function(action) {

    if(this.showEventsInCalendar == true) {
      switch(action) {
        case 0:
          if(this.eventsSectionhere == true) {
            return;
          }
          this._messageList._removeSection(this.eventsSection);   
          this.box.insert_child_at_index(this.eventsSection.actor,this.showingSections.indexOf(this.eventsSection));
          this.eventsSectionhere = true;
          return;
        case 1: 
          if(this.eventsSectionhere == false) {
            return;
          }
       	  this.box.remove_child(this.box.get_children()[this.showingSections.indexOf(this.eventsSection)]);
       	  this._messageList._addSection(this.eventsSection);
       	  this.eventsSectionhere = false;
          return;
      }
    }
  },
  
  manageLabel:function(nCount,eCount) {  

    this.notificationLabel.visible = nCount*this.newNotificationAction;
    this.eventsLabel.visible = eCount*this.newNotificationAction;
    
    if(this.eventsLabel.visible == true){
      this.eventsIcon.show();
    }
    
    if(this.newNotificationAction == 2) {

        if(nCount>0) {
          this.notificationLabel.text=nCount.toString()+" ";      
        }
        if(eCount > 0 ) {   
          this.eventsLabel.text=eCount.toString()+" ";
        }
        return;
    }
    
  },
    
  middleClickDndToggle: function (actor, event) {

    switch(event.get_button()) {
      case 1 :  // if left click
        if (this.menu.isOpen) {
          if((this.notificationSection.actor.height*this.notificationSectionToBeShown + 
              this.mediaSection.actor.height*this.mediaSectionToBeShown+
              this.eventsSection.actor.height*this.eventsSectionToBeShown) != this.scrollView.height) {
                log('Detected missing messages. Rebuilding');
                this.removeAndDisconnectSections();
                this.rebuildMessageList();
                this.manageEvents(0);            
          }

          this._messageList.setDate(new Date());
          this.blinkIconStop();
          if(this.prefs.get_boolean("show-label")==false) { 
            this.notificationCount=0;
            this.eventsCount=0;
          }
          this.rightClick = true;
          this.resetIndicator();
        }
        return;
        
      case 2: // if middle click
      
        // close the menu, since it gets open on any click
        if (this.menu.isOpen) {
          this.menu.actor.hide();
        }
        // toggle DND state
        this.dndToggle();
        // reload dnd status
        this.loadDndStatus();
      
        return;
    
      case 3 :  //if right click 
        if(this.rightClick==false && this.menu.isOpen == true) {
          this.removeAndDisconnectSections();
          this.rebuildMessageList();
          this.manageEvents(0);
          this.rightClick = true;
          return ;
        }

        if(this.rightClick==true || this.menu.isOpen==false) {
          this.rightClick = false;
        }
        return;
      }
  },

  newNotif: function(messageType) {

    switch(messageType) {
      case "media": 
        this.mediaCount++;
        break;
      case "notification" : 
        this.notificationCount++; 
        this.filterNotifications();
        break;
      case "events" :
        this.eventsCount++;
        break;
    }
    this.resetIndicator();
  },

  rebuildMessageList: function() {

    this._messageList.setDate(new Date());
    
    for(let i=0;i<this.orderOfSections.length;i++){
      this.addThisSection(this[this.orderOfSections[i]+"Section"]       ,this[this.orderOfSections[i]+"SectionToBeShown"]        ,this.orderOfSections[i]);
    }
  },

  remNotif: function(messageType) {

    switch(messageType) {
      case "media" :
        this.mediaCount--;
        break;
      case "notification" : 
        (this.notificationCount>0)? this.notificationCount-- : 0;
        break;
      case "events" :
        (this.eventsCount>0)? this.eventsCount-- : 0;
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
    this.manageClearButtonVisibility();
        
    this.eventsCount=this.eventsCount*this.includeEventsCount;
    
    if( this.loadDndStatus() == false ) {
        this.manageLabel((this.notificationCount + (!this.showThreeIcons)*this.eventsCount) ,(this.showThreeIcons)*this.eventsCount); 
    }
        
  },

  seen: function() {

    if (!this.menu.isOpen) {
      this.rightClick = false;
      this.resetIndicator();
      return ;
    }
    this.manageEvents(0);
 
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

    Main.messageTray._bannerBin.x = (this.prefs.get_enum('banner-pos')-1)*(Main.layoutManager.monitors[0].width-(Main.messageTray._bannerBin.width=this.menu.actor.width));
    this.removeDotFromDateMenu();
    this.resetIndicator();
    
    this.indicatorViewShortcut();
    
    this.menu.connect("open-state-changed",()=>this.seen());
    
    this.dnditem.connect("toggled", ()=>this.dndToggle());
    
    if(this.prefs.get_boolean("middle-click-dnd")) {
      this.actor.connect("button-press-event", (actor, event)=>this.middleClickDndToggle(actor, event));
    }
    
    if(this.eventsSectionToBeShown) {
      this.dmSig=Main.panel.statusArea.dateMenu.menu.connect("open-state-changed",()=> {
        if(!Main.panel.statusArea.dateMenu.menu.isOpen) {
          this._messageList.setDate(new Date());
        }
        if(this.showEventsInCalendar == true) { 
          this.manageEvents(1);
          if(this.prefs.get_boolean("show-label")==false) {
            this.eventsCount=0;
          }
        } 
        this.resetIndicator();
      });
    }
    
    if(this.menuAutoclose) {
      this.cmsig = global.display.connect('notify::focus-window', () => this.autoCloseMenu());
    }
  },

  undoChanges: function () {

    if(this._loopTimeoutId!=null) { 
      Mainloop.source_remove(this._loopTimeoutId); 
      this._loopTimeoutId=null;
    }    

    this.manageEvents(0);
    this.removeAndDisconnectSections();

    this._messageList._removeSection(this.mediaSection);
    this._messageList._removeSection(this.notificationSection);
    this._messageList._removeSection(this.eventsSection);
    this._messageList._addSection(this.mediaSection);
    this._messageList._addSection(this.notificationSection);
    this._messageList._addSection(this.eventsSection);
    
    Main.messageTray._bannerBin.show();
    Main.messageTray._bannerBin.x=0;
    
    if(this.eventsSectionToBeShown) {
      Main.panel.statusArea.dateMenu.menu.disconnect(this.dmSig);
    }
    
    if(this.menuAutoclose) {
       global.display.disconnect(this.cmsig);
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
