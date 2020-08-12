/*
Version 19.1
============

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
  notificationCenter.reloadSignal = notificationCenter.prefs.connect("changed::reload-signal", () => {
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
    this.reloadSignal = null;
    
    this.dndpref = new Gio.Settings({schema_id:"org.gnome.desktop.notifications"});
    this.parent(1-0.5*this.prefs.get_enum('indicator-pos'), "NotificationCenter");
    this.loadPreferences();

    this.connectedSignals = [];

    this.dmsig  = null;
    this.cmsig  = null;
    this.dndSig = null;
    
    this.isDndOff = true;
    
    this._loopTimeoutId = null;
    
    this.textureCache         = St.TextureCache.get_default();
    this.iconThemeChangeSig   = null;
    this.notificationIconName = null;
    
    this.notificationCount = 0;
    this.eventsCount       = 0;
    this.mediaCount        = 0;
    
    this.eventsIcon  = new St.Icon({icon_name: "x-office-calendar-symbolic",style_class:'system-status-icon',visible:false});
    this.eventsLabel = new St.Label({ text: "• ",visible:false});
    
    this.mediaIcon = new St.Icon({icon_name : "audio-x-generic-symbolic",style_class:'system-status-icon',visible:false});
    
    this.notificationIcon  = new St.Icon({style_class:'system-status-icon',visible:false});
    this.notificationLabel = new St.Label({ text: "• ",visible:false});
    
    this._indicator =  new St.BoxLayout({ vertical: false, style_class: 'panel-status-menu-box',style:"spacing:0.0em"});
    
    this._messageList        = Main.panel.statusArea.dateMenu._messageList;
    this.mediaSection        = this._messageList._mediaSection;
    this.notificationSection = this._messageList._notificationSection;
    this.eventsSection       = this._messageList._eventsSection;
    
    this.box                   = new St.BoxLayout({style_class:"message-list-sections",vertical: true}); 
    this.notificationCenterBox = new St.BoxLayout({style_class:"message-list-section",vertical: true});
    
    this.dndItem     = (Config.PACKAGE_VERSION < "3.34") ? new PopupMenu.PopupSwitchMenuItem(_("Do Not Disturb")) : new PopupMenu.PopupSwitchMenuItem(_("Do Not Disturb"),true,{});
    this.clearButton = new St.Button({style_class: 'message-list-clear-button button',style:"margin-left:4px; margin-right: 4px;",label: _("Clear"),can_focus: true,visible:false});
    
    let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
    this.scrollView = (Config.PACKAGE_VERSION < "3.36") ? new St.ScrollView({hscrollbar_policy:2,x_fill:true,y_fill:true,style:"min-width:"+(this._messageList.actor.width/scaleFactor)+"px;max-height: "+0.01*this.prefs.get_int("max-height")*Main.layoutManager.monitors[0].height+"px; max-width: "+(this._messageList.actor.width/scaleFactor)+"px; padding: 0px;"}) : new St.ScrollView({hscrollbar_policy:2,x_fill:true,y_fill:true,style:"min-width:"+(this._messageList.width/scaleFactor)+"px;max-height: "+0.01*this.prefs.get_int("max-height")*Main.layoutManager.monitors[0].height+"px; max-width: "+(this._messageList.width/scaleFactor)+"px; padding: 0px;"});
    
    this.panelButtonActor = (Config.PACKAGE_VERSION < "3.34") ? this.actor : this;
    this.panelButtonActor.add_style_class_name('notification-center-panel-button');
    

  },

  addClearButton: function() {

    if(this.prefs.get_enum("clear-button-alignment")==3){
      return;
    }

      this.clearButton.connect('clicked', Lang.bind(this, function(){
        let len=this.showingSections.length;
        while(len!=0) {
          this[this.showingSections[len-1]+"Section"].clear();
          len--;
        }
      }));
      
      this.clearButton.set_x_align(1+this.prefs.get_enum('clear-button-alignment'));
      this.box.add_actor(this.clearButton);

  },

  arrangeItems: function(pos){

    this.notificationCenterBox._delegate=this;
    this.menu.box.add_child(this.notificationCenterBox);
    this.scrollView.add_actor(this.box);
    
    if(pos > 0) {
    
      this.dndItem.connect("toggled", ()=>this.dndToggle());
      
      if(Config.PACKAGE_VERSION >= "3.36.0") {
        this._messageList._dndSwitch.hide();
        this._messageList.get_children()[1].get_children()[1].get_children()[0].hide();
        
        switch(pos) {
          case 1:
            this.notificationCenterBox.add_child(this.dndItem);
            this.notificationCenterBox.add_actor(new PopupMenu.PopupSeparatorMenuItem());
            this.notificationCenterBox.add_child(this.scrollView);
            this.addClearButton();
            return;
          default:
            this.notificationCenterBox.add_child(this.scrollView);
            this.addClearButton();
            this.notificationCenterBox.add_actor(new PopupMenu.PopupSeparatorMenuItem());
            this.notificationCenterBox.add_child(this.dndItem);
            return;
        }
         
      }
      else {
        switch(pos) {
          case 1:
            this.notificationCenterBox.add_child(this.dndItem.actor);
            this.notificationCenterBox.add_child(new PopupMenu.PopupSeparatorMenuItem().actor);
            this.notificationCenterBox.add_child(this.scrollView);
            this.addClearButton();
            return;
          default:
            this.notificationCenterBox.add_child(this.scrollView);
            this.addClearButton();
            this.notificationCenterBox.add_child(new PopupMenu.PopupSeparatorMenuItem().actor);
            this.notificationCenterBox.add_child(this.dndItem.actor);
            return;
        }
      
      }
    }
    
    this.notificationCenterBox.add_child(this.scrollView);      
    this.addClearButton();    
    
  },

  autoCloseMenu : function() {

    if(global.display.focus_window!= null && this.menu.isOpen) {
      this.menu.close();
    }

  },
  
  blinkIcon: function(blinkTimes,interval,opacity) {

    this.blinkIconStopIfBlinking(opacity);

    if(blinkTimes > 0) {
      this._loopTimeoutId=Mainloop.timeout_add(interval, ()=> this.blinkIcon(--blinkTimes,interval,(opacity==255)?100:255));
    }

  },

  blinkIconStopIfBlinking: function(opacity) {

    if(this._loopTimeoutId!=null) {
      Mainloop.source_remove(this._loopTimeoutId);
      this._loopTimeoutId=null;
      this.notificationIcon.set_opacity(opacity);
    }

  },

  dndToggle: function() {

    this.dndpref.set_boolean('show-banners',!this.dndpref.get_boolean('show-banners'));

  },

  filterNotifications: function() {
  
    if(this.isDndOff) {

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

      this.blinkIcon(2*!this.menu.isOpen*this.prefs.get_int("blink-icon"),this.prefs.get_int("blink-time"),255);

    }

  },

  indicatorViewShortcut : function() {

    Main.wm.addKeybinding(
      'indicator-shortcut',
      this.prefs,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
      () => {
        this.notificationIcon.visible = !(this.mediaIcon.visible || this.eventsIcon.visible);
        this.panelButtonActor.visible = !this.panelButtonActor.visible ;
      }
    );

  },

  loadDndStatus: function () {

    this.isDndOff = this.dndpref.get_boolean("show-banners");

    if(this.prefs.get_enum("dnd-position")>0) {
      this.dndItem.setToggleState(!this.isDndOff);
    }

    this.blinkIconStopIfBlinking(255);
    this.manageAutohide();

    this.notificationIcon.icon_name = this.notificationIconName;

    if(this.isDndOff) {
      this.notificationIcon.set_opacity(255);
      this.manageLabel();
      return false;

    }
 
    if(Gtk.IconTheme.get_default()){
      if(Gtk.IconTheme.get_default().has_icon("notifications-disabled-symbolic")) {
        this.notificationIcon.icon_name = "notifications-disabled-symbolic";
      }
    }
    else {
      this.notificationIcon.set_opacity(150);
   }

    Main.messageTray._bannerBin.hide();
    this.notificationLabel.hide();
    this.eventsLabel.hide();
    return true;

  },

  loadPreferences: function() {

    this.autohide = this.prefs.get_int("autohide");
    this.mediaSectionToBeShown = (this.prefs.get_int("show-media")>0)?true:false;
    this.notificationSectionToBeShown = (this.prefs.get_int("show-notification")>0)?true:false;
    this.eventsSectionToBeShown = (this.prefs.get_int("show-events")>0)?true:false;
    this.showEventsInCalendarAlso=(this.eventsSectionToBeShown)?this.prefs.get_boolean("show-events-in-calendar"): false;
    this.showThreeIcons = this.prefs.get_boolean("individual-icons");
    this.includeEventsCount=this.prefs.get_boolean("include-events-count");
    this.newNotificationAction=this.prefs.get_enum("new-notification");
    this.menuAutoclose = this.prefs.get_boolean("autoclose-menu");
    this.eventsSectionhere = this.showEventsInCalendarAlso;
    this.showingSections = this.prefs.get_strv("sections-order");

  },

  manageAutohide: function() {

    if(this.menu.isOpen) {
      return;
    }

    this.mediaIcon.visible = this.mediaSection._shouldShow() && this.showThreeIcons && this.mediaSectionToBeShown;
    this.eventsIcon.visible = this.eventsSection._list.get_children().length && this.showThreeIcons && this.eventsSectionToBeShown;
    this.notificationIcon.visible = (this.notificationSection._list.get_children().length && this.notificationSectionToBeShown) ||
                                    (this.mediaSection._shouldShow() && this.mediaSectionToBeShown && !this.showThreeIcons) ||
                                    (this.eventsSection._list.get_children().length && this.eventsSectionToBeShown && !this.showThreeIcons)||
                                    ((!this.isDndOff)*this.autohide > 1);

    if(this.mediaIcon.visible || this.eventsIcon.visible || this.notificationIcon.visible || !this.autohide) {
      this.panelButtonActor.visible = true;
      this.notificationIcon.visible = (this.mediaIcon.visible || this.eventsIcon.visible) ? this.notificationIcon.visible : true;
      return;
    }

    this.panelButtonActor.visible = false;

  },

  manageClearButtonVisibility: function() {

    if(this.menu.isOpen) {

      this.clearButton.visible = (Config.PACKAGE_VERSION < "3.36.0") ? this.notificationSection._canClear() && this.notificationSectionToBeShown : this.notificationSection._canClear && this.notificationSectionToBeShown;

      if(Config.PACKAGE_VERSION < "3.32") {
        this.clearButton.visible = (this.clearButton.visible)||(this.eventsSection._list.get_children().length && this.eventsSectionToBeShown);
      }
    }

  },

  manageEvents: function(action) {

    if(this.showEventsInCalendarAlso == true) {
      switch(action) {
        case 0:
          if(this.eventsSectionhere == true) {
            return;
          }
          this._removeSection(this.eventsSection);
          (Config.PACKAGE_VERSION < "3.36") ? this.box.insert_child_at_index(this.eventsSection.actor,this.showingSections.indexOf("events")): this.box.insert_child_at_index(this.eventsSection,this.showingSections.indexOf("events"));
          this.eventsSectionhere = true;
          return;
        case 1:
          if(this.eventsSectionhere == false) {
            return;
          }
          this.box.remove_child(this.box.get_children()[this.showingSections.indexOf("events")]);
          this._messageList._addSection(this.eventsSection);
          this.eventsSectionhere = false;
          return;
      }
    }
  },

  manageLabel:function(nCount,eCount) {

    this.notificationLabel.visible = nCount*this.newNotificationAction;
    this.eventsLabel.visible = eCount*this.newNotificationAction;

    if (this.prefs.get_boolean("change-icons")) {
        this.manageIconChange(nCount > 0 || eCount > 0);
    }

    if(this.newNotificationAction == 2) {

        if(nCount>0) {
          this.notificationLabel.text=nCount.toString()+" ";
        }
        if(eCount > 0 ) {
          this.eventsLabel.text=eCount.toString()+" ";
        }

    }

  },

  manageIconChange: function(statusIcon) {

    let iconName = statusIcon ? "notification-center-full" : "notification-center-empty";

    this.notificationIcon.icon_name = iconName;
    
  },

  middleClickDndToggle: function (actor, event) {

    switch(event.get_button()) {

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

      }

  },

  newNotif: function(messageType) {

    switch(messageType) {
      case "media":
        this.mediaCount++;
        break;
      case "notification" :
        this.notificationCount = this.notificationCount+ !this.menu.isOpen;
        this.filterNotifications();
        break;
      case "events" :
        this.eventsCount = this.eventsCount + !this.menu.isOpen;
        break;
    }

    this.resetIndicator();

  },

  rebuildMessageList: function() {

    this._messageList.setDate(new Date());

    for(let i=0;i<this.showingSections.length;i++) {

      if(Config.PACKAGE_VERSION < "3.36") {
        this._messageList._removeSection(this[this.showingSections[i]+"Section"]) ;
        this.box.add(this[this.showingSections[i]+"Section"].actor);
      }
      else {
        this._removeSection(this[this.showingSections[i]+"Section"]);
        this.box.add(this[this.showingSections[i]+"Section"]);
      }
      
      this.connectedSignals.push(this[this.showingSections[i]+"Section"]._list.connect('actor-added'   ,()=> this.newNotif(this.showingSections[i]) ));
      this.connectedSignals.push(this[this.showingSections[i]+"Section"]._list.connect('actor-removed' ,()=> this.remNotif(this.showingSections[i]) ));

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
      this[this.showingSections[len-1]+"Section"]._list.disconnect(this.connectedSignals[2*len-1]);
      this[this.showingSections[len-1]+"Section"]._list.disconnect(this.connectedSignals[2*len-2]);

      this.box.remove_child(this.box.get_children()[len-1]);
      this._messageList._addSection(this[this.showingSections[len-1]+"Section"]);

      this.connectedSignals.pop();
      this.connectedSignals.pop();
      len--;
    }

  },

  removeDotAndBorderFromDateMenu: function() {

    if(Config.PACKAGE_VERSION < "3.34") {
      Main.panel.statusArea.dateMenu.actor.get_children()[0].remove_actor(Main.panel.statusArea.dateMenu._indicator.actor);
      this.dtActors=Main.panel.statusArea.dateMenu.actor.get_children()[0].get_children();
      Main.panel.statusArea.dateMenu.actor.get_children()[0].remove_actor(this.dtActors[0]);
    }
    else {
      (Config.PACKAGE_VERSION < "3.36") ? Main.panel.statusArea.dateMenu.get_children()[0].remove_actor(Main.panel.statusArea.dateMenu._indicator.actor): Main.panel.statusArea.dateMenu.get_children()[0].remove_actor(Main.panel.statusArea.dateMenu._indicator)
      this.dtActors=Main.panel.statusArea.dateMenu.get_children()[0].get_children();
      Main.panel.statusArea.dateMenu.get_children()[0].remove_actor(this.dtActors[0]);
    }
    
    if(this.showingSections.length == 3 && !this.showEventsInCalendarAlso) {
      if(Config.PACKAGE_VERSION < "3.36") {
        this._messageList.actor.get_parent().get_children()[1].style="border-width: 0px";
      }
      else {
        this._messageList.get_parent().get_children()[1].style="border-width: 0px";
      }
    }
     
  },
  
  _removeSection(section) {

    (Config.PACKAGE_VERSION < "3.36") ? this._messageList._sectionList.remove_actor(section.actor):this._messageList._sectionList.remove_actor(section);
    this._messageList._sync();

  },

  resetIndicator: function() {

    this.manageAutohide();
    this.manageClearButtonVisibility();

    this.eventsCount=this.eventsCount*this.includeEventsCount;

    if(this.isDndOff) {
      this.manageLabel((this.notificationCount + (!this.showThreeIcons)*this.eventsCount) ,(this.showThreeIcons)*this.eventsCount);
    }

  },

  seen: function() {


    if(!this.menu.isOpen) {
      this.resetIndicator();
      return ;
    }

    this.manageEvents(0);

    (Config.PACKAGE_VERSION < "3.36") ? this.mediaSection.actor.visible = true        : this.mediaSection.visible=true;
    (Config.PACKAGE_VERSION < "3.36") ? this.notificationSection.actor.visible = true : this.notificationSection.visible=true;
    (Config.PACKAGE_VERSION < "3.36") ? this.eventsSection.actor.visible = true       : this.eventsSection.visible = true;
    
    this._messageList.setDate(new Date());

    this.blinkIconStopIfBlinking(255);

    if(this.prefs.get_boolean("show-label")==false) {
      this.notificationCount=0;
      this.eventsCount=0;
    }

    this.resetIndicator();

  },

  setNotificationIconName: function () {
    if(Gtk.IconTheme.get_default()) {
    this.notificationIconName = Gtk.IconTheme.get_default().has_icon("notification-symbolic")?"notification-symbolic":"preferences-system-notifications-symbolic";
    }
    else {
      this.notificationIconName = "preferences-system-notifications-symbolic";
    }
  },

  iconThemeChanged: function() {
    this.setNotificationIconName();
    this.loadDndStatus();
  },

  startNotificationCenter: function() {

    this._indicator.add_child(this.eventsIcon);
    this._indicator.add_child(this.eventsLabel);
    this._indicator.add_child(this.mediaIcon);
    this._indicator.add_child(this.notificationIcon);
    this._indicator.add_child(this.notificationLabel);

    this.setNotificationIconName();
    this.iconThemeChangeSig = this.textureCache.connect('icon-theme-changed', this.iconThemeChanged.bind(this));

    this.panelButtonActor.add_child(this._indicator);
    Main.panel.addToStatusArea("NotificationCenter", this, this.prefs.get_int('indicator-index'), this.prefs.get_string('indicator-pos'));

    this.rebuildMessageList();
    this.arrangeItems(this.prefs.get_enum("dnd-position"));
    
    this.loadDndStatus();
    this.resetIndicator();

    Main.messageTray.bannerAlignment = this.prefs.get_enum('banner-pos');

    this.removeDotAndBorderFromDateMenu();
    this.indicatorViewShortcut();

    this.menu.connect("open-state-changed",()=>this.seen());

    this.dndSig = this.dndpref.connect("changed::show-banners", () => {
      this.loadDndStatus();
    });

    if(this.prefs.get_boolean("middle-click-dnd")) {
      this.panelButtonActor.connect("button-press-event", (actor, event)=>this.middleClickDndToggle(actor, event));
    }

    if(this.eventsSectionToBeShown) {
      this.dmSig=Main.panel.statusArea.dateMenu.menu.connect("open-state-changed",()=> {
        Main.panel.statusArea.dateMenu._calendar.setDate(new Date());
        if(this.showEventsInCalendarAlso == true && Main.panel.statusArea.dateMenu.menu.isOpen) {
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

    this.blinkIconStopIfBlinking(255);
    
    if(Config.PACKAGE_VERSION < "3.36") {
      this._messageList.actor.get_parent().get_children()[1].style="";
    }
    else {
      this._messageList.get_parent().get_children()[1].style="";
    }

    this.manageEvents(0);
    this.removeAndDisconnectSections();

    (Config.PACKAGE_VERSION < "3.36") ? this._messageList._removeSection(this.mediaSection) :        this._removeSection(this.mediaSection);
    (Config.PACKAGE_VERSION < "3.36") ? this._messageList._removeSection(this.notificationSection) : this._removeSection(this.notificationSection);
    (Config.PACKAGE_VERSION < "3.36") ? this._messageList._removeSection(this.eventsSection) :       this._removeSection(this.eventsSection);
 
    this._messageList._addSection(this.mediaSection);
    this._messageList._addSection(this.notificationSection);
    this._messageList._addSection(this.eventsSection);

    Main.messageTray._bannerBin.show();
    Main.messageTray.bannerAlignment = 2;

    if(this.eventsSectionToBeShown) {
      Main.panel.statusArea.dateMenu.menu.disconnect(this.dmSig);
    }

    if(this.menuAutoclose) {
       global.display.disconnect(this.cmsig);
    }

    if(this.dndSig!=null){
      this.dndpref.disconnect(this.dndSig);
      this.dndItem.destroy();
    }

    if(this.iconThemeChangeSig!=null){
      this.textureCache.disconnect(this.iconThemeChangeSig);
    }

    if(Config.PACKAGE_VERSION < "3.34") {
      Main.panel.statusArea.dateMenu.actor.get_children()[0].insert_child_at_index(this.dtActors[0],0);
      Main.panel.statusArea.dateMenu.actor.get_children()[0].add_actor(Main.panel.statusArea.dateMenu._indicator.actor);
    }
    else {
      Main.panel.statusArea.dateMenu.get_children()[0].insert_child_at_index(this.dtActors[0],0);
      (Config.PACKAGE_VERSION < "3.36") ? Main.panel.statusArea.dateMenu.get_children()[0].add_actor(Main.panel.statusArea.dateMenu._indicator.actor) : Main.panel.statusArea.dateMenu.get_children()[0].add_actor(Main.panel.statusArea.dateMenu._indicator) 
    }

    Main.wm.removeKeybinding('indicator-shortcut');

    this.eventsIcon.destroy();
    this.eventsLabel.destroy();
    this.mediaIcon.destroy();
    this.notificationIcon.destroy();
    this.notificationLabel.destroy();
    this._indicator.destroy();

    this.clearButton.destroy();
    this.box.destroy();
    this.scrollView.destroy();
    this.notificationCenterBox.destroy();

    this.prefs.disconnect(this.reloadSignal);

  },

});
