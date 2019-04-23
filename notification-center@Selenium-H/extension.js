// Version 15

const Config = imports.misc.config;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Meta = imports.gi.Meta;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const _ = imports.gettext.domain("notification-center").gettext;

let notificationCenter;

function enable()
{
  notificationCenter = new NotificationCenter();
  notificationCenter.startNotificationCenter();
}

function disable()
{
  notificationCenter.undoChanges();   	
  notificationCenter.destroy();
}

const NotificationCenter = new Lang.Class({
  Name: "NotificationCenter",
  Extends: PanelMenu.Button,

  _init: function ()
  {
  
    this.initTranslations();
    this.dndpref = new Gio.Settings({schema_id:'org.gnome.desktop.notifications'});	
    this.prefs 	= new Gio.Settings({	settings_schema: Gio.SettingsSchemaSource.new_from_directory(Me.path + "/schemas", Gio.SettingsSchemaSource.get_default(), false).lookup(Me.metadata["settings-schema"], true) });
    this.parent(1-0.5*this.prefs.get_enum('indicator-pos'), "NotificationCenter");
    
    this.connectedSignals = [];
    this.showingSections = [];
    this._loopTimeoutId = null;
    this.unseen = 0;
    
    this.icon = new St.Icon({style_class:'system-status-icon'});
    this.label = new St.Label({ text: '',visible:false});
    this._indicator =  new St.BoxLayout({ vertical: false, style_class: 'panel-status-menu-box',style:"spacing:0.0em"});

    this._messageList = Main.panel.statusArea.dateMenu._messageList;
    this.notifyEntry  = new PopupMenu.PopupBaseMenuItem({reactive:false});     
    this.box  = new St.BoxLayout({ vertical: true});
    this.scrollView   = new St.ScrollView({hscrollbar_policy:2,x_fill:true,y_fill:true,style:"min-width:"+this._messageList.actor.width+"px;max-height: "+0.01*this.prefs.get_int("max-height")*Main.layoutManager.monitors[0].height+"px; max-width:"+this._messageList.actor.width+"px; padding: 0px;"});
    this.clearButtonEntry = new PopupMenu.PopupBaseMenuItem({reactive:false});
    this.dnditem = new PopupMenu.PopupSwitchMenuItem(_("Do Not Disturb")); 
  },

  addClearButton: function()
  {
    if(this.prefs.get_enum("clear-button-alignment")==3){
      return;
    }
	
    let box = new St.BoxLayout({ style:"min-width:"+this._messageList.actor.width+"px; padding-bottom:0px",vertical: true});
    this.clearButton = new St.Button({style_class: 'message-list-clear-button button',label: _("Clear All"),can_focus: true});
    this.clearButton.set_x_align(1+this.prefs.get_enum('clear-button-alignment'));
    this.clearButton.connect('clicked',()=>	
      { 	
        let len=this.showingSections.length;
        while(len!=0){	
          this.showingSections[len-1].clear();
	        len--;
        }
        this.clearButtonEntry.actor.hide();
      });
    box.add(this.clearButton);
    this.clearButtonEntry.actor.add(box);
    this.menu.addMenuItem(this.clearButtonEntry);
  },

  addThisSection:function(section,KEY,fNo)
  {
    if(this.prefs.get_boolean(KEY)){
      this._messageList._removeSection(section);
      this.box.add(section.actor);
      this.connectedSignals.push(section._list.connect('actor-added'   ,Lang.bind( this ,(fNo==0) ? this.newNotif : this.resetIndicator )))
      this.connectedSignals.push(section._list.connect('actor-removed' ,Lang.bind( this ,(fNo==0) ? this.remNotif : this.resetIndicator )));
      this.showingSections.push(section);   
    }
  },

  blinkIcon: function()
  {
    if(this.prefs.get_boolean("blink-icon") && this.dndpref.get_boolean("show-banners")){
      if(this._loopTimeoutId!=null) {
        Mainloop.source_remove(this._loopTimeoutId);		
      }
      this.icon.set_opacity((this.icon.get_opacity()==255)? 100 : 255);
      this._loopTimeoutId=Mainloop.timeout_add(this.prefs.get_int('blink-time'), Lang.bind(this, this.blinkIcon));
    }
  },

  dndToggle: function()
  {
    (this.dndpref.get_boolean('show-banners')==true) ? this.dndpref.set_boolean('show-banners',false):this.dndpref.set_boolean('show-banners',true);
  },

  filterNotifications: function()
  {
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
            this.unseen--;
            return ;
      }
    }
    this.blinkIcon();
  },

	indicatorViewShortcut : function()
	{
	  Main.wm.addKeybinding(
      'indicator-shortcut',
      this.prefs,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
      () => { (this.actor.visible==true) ? this.actor.hide() : this.actor.show(); }
    );
	},

	initTranslations:function()
	{
	  let localeDir = Me.dir.get_child("locale");
		Gettext.bindtextdomain("notification-center", localeDir.query_exists(null) ? localeDir.get_path() : Config.LOCALEDIR );
	},

  loadDndStatus: function ()
 	{
		this.icon.icon_name = Gtk.IconTheme.get_default().has_icon("notification-symbolic")?"notification-symbolic":"preferences-system-notifications-symbolic";
		
    if(this.dndpref.get_boolean("show-banners")) {
			this.dnditem.setToggleState(false);
			this.icon.set_opacity(255);
      Main.messageTray._bannerBin.show();
      return false;
		}
		
		this.dnditem.setToggleState(true); 
		this.icon.set_opacity(150);
		this.label.hide();
    Main.messageTray._bannerBin.hide();
    return true;
	},

	middleClickDndToggle: function(actor, event) {
		let button = event.get_button();
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

	manageAutohide: function()
	{
		if(this.menu.isOpen) {
		  return;
		}

		this.clearButtonEntry.actor.show();
		if(this.prefs.get_boolean("show-notifications")) {
		  if(this._messageList._notificationSection._canClear()) {
		    this.actor.show(); 
		    return;
		  }
		}
		if(this.prefs.get_boolean("show-events")) {
			if(Config.PACKAGE_VERSION < "3.32.0") {
				if(this._messageList._eventsSection._canClear()==false) {this.actor.hide();} else {this.actor.show();return;}
			}
			else{
				this._messageList._eventsSection._reloadEvents(); 
				if(this._messageList._eventsSection._shouldShow()) {this.actor.show(); this.clearButtonEntry.actor.hide();return;}
			}
		}
		if(this.prefs.get_boolean("show-media")) {
		  if(this._messageList._mediaSection._shouldShow()) {
		    this.actor.show(); 
		    this.clearButtonEntry.actor.hide();
		    return;
		  }
		}
		
		(this.prefs.get_boolean("autohide")==false)?this.actor.show(): this.actor.hide();
		this.clearButtonEntry.actor.hide();
	},

	manageEvents: function(action)
	{
		if(this.prefs.get_boolean("show-events") ==true && this.prefs.get_boolean("show-events-in-calendar") == true){
		  switch(action){
		   	case 0: 
		   	  this._messageList._removeSection(this._messageList._eventsSection); this.box.add(this._messageList._eventsSection.actor);	
		   	  return;
		   	case 1: 
		   	  this.box.remove_child(this.box.get_children()[this.showingSections.length-1]);this._messageList._addSection(this._messageList._eventsSection);
				  return;
		  }
		}
	},

  newNotif: function()
	{
    this.unseen++; 
		this.filterNotifications();
	  this.resetIndicator();
	},

  remNotif: function()
	{
		this.unseen--;
		this.resetIndicator();
	},

	removeDotFromDateMenu: function()
	{
		Main.panel.statusArea.dateMenu.actor.get_children()[0].remove_actor(Main.panel.statusArea.dateMenu._indicator.actor);	
		this.dtActors=Main.panel.statusArea.dateMenu.actor.get_children()[0].get_children();
		Main.panel.statusArea.dateMenu.actor.get_children()[0].remove_actor(this.dtActors[0]);
	},

  resetIndicator: function()
	{
		this.manageAutohide();
		if(this.loadDndStatus()==false&&this.unseen>0) {
		  switch(this.prefs.get_enum("new-notification")) {
  			case 1	: 	
  			  this.label.show(); 
  			  this.label.text='• '; 			
  			  return;
	  		case 2	: 	
	  		  this.label.show(); 
	  		  this.label.text=this.unseen.toString()+' '; 	
	  		  return;
	  		default : 	
	  		  this.label.hide();						
	  		  return;
		  }
		}

		if(this.unseen<=0) {
   		this.label.hide();
			this.unseen=0;
			if(this._loopTimeoutId!=null) { 
			  Mainloop.source_remove(this._loopTimeoutId); 
			  this._loopTimeoutId=null;
			}		
		}
	},

  seen: function()
	{
   	if (this.menu.isOpen) {
			this._messageList.setDate(new Date());
			this.manageEvents(0);
			if(this._loopTimeoutId!=null) { 
			  Mainloop.source_remove(this._loopTimeoutId); 
			  this._loopTimeoutId=null;
			}		
			if(this.prefs.get_boolean("show-label")==false) { 
			  this.unseen=0;
			}
    }
    
		if (!this.menu.isOpen) {
		  this.manageEvents(1);
		}
		
		this.resetIndicator();
  },

	startNotificationCenter: function()
	{
		this._indicator.add_child(this.icon);
    this._indicator.add_child(this.label);
    this.actor.add_child(this._indicator);
		Main.panel.addToStatusArea("NotificationCenter", this, 2, this.prefs.get_string('indicator-pos'));

		this.addThisSection(this._messageList._mediaSection	   ,"show-media"	 ,1);
		this.addThisSection(this._messageList._notificationSection ,"show-notifications" ,0);
		this.addThisSection(this._messageList._eventsSection 	   ,"show-events" 	 ,1);
		this.manageEvents(1);
		this.scrollView.add_actor(this.box);
		this.notifyEntry.actor.add(this.scrollView);
		
		switch(this.prefs.get_enum("dnd-position")){
			case 1 : 
			  this.menu.addMenuItem(this.dnditem); 
			case 0 : 
			  this.menu.addMenuItem(this.notifyEntry); this.addClearButton();  						
			  break;
      default: 
        this.menu.addMenuItem(this.notifyEntry); 
        this.addClearButton();
				this.menu.addMenuItem(new PopupMenu.PopupBaseMenuItem({reactive:false})); 
				this.menu.addMenuItem(this.dnditem); 
				break;
		}
		Main.messageTray._bannerBin.x =	(this.prefs.get_enum('banner-pos')-1)*(Main.layoutManager.monitors[0].width-(Main.messageTray._bannerBin.width= 						 this.scrollView.width));
		this.removeDotFromDateMenu();
		this.resetIndicator();
		
		this.indicatorViewShortcut();
		this.menu.connect("open-state-changed",()=>this.seen());
		this.dnditem.connect("toggled", ()=>this.dndToggle());
		if(this.prefs.get_boolean("middle-click-dnd")) {
		  this.actor.connect("button-press-event", (actor, event)=>this.middleClickDndToggle(actor, event));
		}
		if(this.prefs.get_boolean("show-events")) {
		  this.dmSig=Main.panel.statusArea.dateMenu.menu.connect("open-state-changed",()=>
		  {
			  if(!Main.panel.statusArea.dateMenu.menu.isOpen){
			    this._messageList.setDate(new Date()); this.resetIndicator();
			  }
		  });
		}
	},

  undoChanges: function () 
	{
		if(this._loopTimeoutId!=null) { 
		  Mainloop.source_remove(this._loopTimeoutId); 
		  this._loopTimeoutId=null;
		}		
		this.manageEvents(0);
		let len=this.showingSections.length;
		
    while(len!=0){
			this.showingSections[len-1]._list.disconnect(this.connectedSignals[2*len-1]);
			this.showingSections[len-1]._list.disconnect(this.connectedSignals[2*len-2]);
			this.box.remove_child(this.box.get_children()[len-1]);
			this._messageList._addSection(this.showingSections[len-1]);
			this.connectedSignals.pop();
			this.connectedSignals.pop(); 
			this.showingSections.pop(); 
	    len--;
		}
		this._messageList._removeSection(this._messageList._mediaSection);
		this._messageList._removeSection(this._messageList._notificationSection);
		this._messageList._removeSection(this._messageList._eventsSection);
		this._messageList._addSection(this._messageList._mediaSection);
		this._messageList._addSection(this._messageList._notificationSection);
		this._messageList._addSection(this._messageList._eventsSection);
		Main.messageTray._bannerBin.show();
		Main.messageTray._bannerBin.x=0;
		
		if(this.prefs.get_boolean("show-events")) {
		  Main.panel.statusArea.dateMenu.menu.disconnect(this.dmSig);
		}

		for(let i=1;i<this.dtActors.length;i++) {
		  Main.panel.statusArea.dateMenu.actor.get_children()[0].remove_actor(this.dtActors[i]);
		}
		
		for(let i=0;i<this.dtActors.length;i++) {
		  Main.panel.statusArea.dateMenu.actor.get_children()[0].add_actor(this.dtActors[i]);
		}
		
		Main.panel.statusArea.dateMenu.actor.get_children()[0].add_actor(Main.panel.statusArea.dateMenu._indicator.actor);
		Main.wm.removeKeybinding('indicator-shortcut');	
	},
});
