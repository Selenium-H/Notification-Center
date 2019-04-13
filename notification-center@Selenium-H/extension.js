const Config = imports.misc.config;
const ExtensionUtils = imports.misc.extensionUtils;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Me = ExtensionUtils.getCurrentExtension();
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const _ = Gettext.domain("notification-center").gettext;
const SHELL_VERSION = imports.misc.config.PACKAGE_VERSION;

let notificationCenter;

function enable()
{
     	notificationCenter = new NotificationCenter();
}

function disable()
{
	notificationCenter.undoChanges();   	
	notificationCenter.destroy();
}

const 	NotificationCenter = new Lang.Class({
    	Name:		     "NotificationCenter",
    	Extends: 	     PanelMenu.Button,

    	_init: function ()
	{
		this.dndpref 	=  new Gio.Settings({schema_id:'org.gnome.desktop.notifications'});	
		this.prefs 	=  new Gio.Settings({	settings_schema: Gio.SettingsSchemaSource.new_from_directory(Me.path + "/schemas", 
							Gio.SettingsSchemaSource.get_default(), false).lookup(Me.metadata["settings-schema"], true) });
		this.connectedSignals = [];
		this.showingSections  = [];
		this._loopTimeoutId   = null;
		this.unseen 	      = 0;

		this.initTranslations();
		this.parent(1-0.5*this.prefs.get_enum('indicator-pos'), "NotificationCenter");	
		this.buildNotificationCenter();
		
        	this.icon 	=  new St.Icon({style_class:'system-status-icon'});
        	this.label 	=  new St.Label({ text: '',visible:false});
		this._indicator =  new St.BoxLayout({ vertical: false, style_class: 'panel-status-menu-box',style:"spacing:0.0em"});
        	this._indicator.add_child(this.icon);
        	this._indicator.add_child(this.label);
        	this.actor.add_child(this._indicator);

		Main.panel.addToStatusArea("NotificationCenter", this, 2, this.prefs.get_string('indicator-pos'));
		Main.messageTray._bannerBin.x = (this.prefs.get_enum('banner-pos')-1)*(Main.layoutManager.monitors[0].width-(Main.messageTray._bannerBin.width = this.scrollView.width));
		this.resetIndicator();
    	},

	addClearButton: function()
	{
		if(this.prefs.get_enum("clear-button-alignment")==3) return;
	
        	this.clearButton = new St.Button({style_class: 'message-list-clear-button button',label: _("Clear All"),can_focus: true});
            	this.clearButton.set_x_align(1+this.prefs.get_enum('clear-button-alignment'));
                this.clearButton.connect('clicked',()=>	{ 	let len=this.showingSections.length;
                						while(len!=0){	this.showingSections[len-1].clear();
	               								len--;
								}this.clearButton.hide();				
							});
        	this.menu.box.add(this.clearButton);
		this.clearButton.hide();
		this.menu.addMenuItem(new PopupMenu.PopupBaseMenuItem({reactive:false}));
	},

	addDndMenu: function()
	{
		this.dnditem = new PopupMenu.PopupSwitchMenuItem(_("Do Not Disturb"));     
		this.dnditem.connect("toggled", ()=>{(this.dnditem.state) ? this.dndpref.set_boolean('show-banners',false):this.dndpref.set_boolean('show-banners',true);});
	},

	addThisSection:function(section,KEY,fNo)
	{
		if(this.prefs.get_boolean(KEY)==false) return;

		this._messageList._removeSection(section);
        	this.box.add(section.actor);
		this.connectedSignals.push(section._list.connect('actor-added'   ,Lang.bind( this ,(fNo==0) ? this.newNotif : this.resetIndicator )))
		this.connectedSignals.push(section._list.connect('actor-removed' ,Lang.bind( this ,(fNo==0) ? this.remNotif : this.resetIndicator )));
		this.showingSections.push(section);   
	},

	blinkIcon: function()
	{
		if(this.prefs.get_boolean("blink-icon"))
		{
			if(this._loopTimeoutId!=null) Mainloop.source_remove(this._loopTimeoutId);		
			this.icon.set_opacity((this.icon.get_opacity()==255)? 100 : 255);
			this._loopTimeoutId=Mainloop.timeout_add(this.prefs.get_int('blink-time'), Lang.bind(this, this.blinkIcon));
		}
	},

	buildNotificationCenter: function()
	{
		this.notifyEntry  = new PopupMenu.PopupBaseMenuItem({reactive:false});     
		this._messageList = Main.panel.statusArea.dateMenu._messageList;
		this.box 	  = new St.BoxLayout({ vertical: true});
		this.scrollView   = new St.ScrollView({ hscrollbar_policy:2,x_fill:true, y_fill: true,style:"min-width:"+this._messageList.actor.width+"px;max-height: "+0.01*this.prefs.get_int("max-height")*Main.layoutManager.monitors[0].height +"px; max-width:"+this._messageList.actor.width+"px; padding: 0px;"});
		this.addDndMenu();
		this.addThisSection(this._messageList._mediaSection	   ,"show-media"	 ,1);
		this.addThisSection(this._messageList._notificationSection ,"show-notifications" ,0);
		this.addThisSection(this._messageList._eventsSection 	   ,"show-events" 	 ,1);
		this.manageEvents(1);
		this.scrollView.add_actor(this.box);
		this.notifyEntry.actor.add(this.scrollView);
		switch(this.prefs.get_enum("dnd-position"))
		{
			case 1 : this.menu.addMenuItem(this.dnditem);
			case 0 : this.menu.addMenuItem(this.notifyEntry); this.addClearButton();  					break;
                        default: this.menu.addMenuItem(this.notifyEntry); this.addClearButton(); this.menu.addMenuItem(this.dnditem); 	break;
		}
		Main.panel.statusArea.dateMenu.actor.get_children()[0].remove_actor(Main.panel.statusArea.dateMenu._indicator.actor);	
		this.menu.connect("open-state-changed",()=>this.seen());
		if(this.prefs.get_boolean("show-events")) this.dmSig = Main.panel.statusArea.dateMenu.menu.connect("open-state-changed",()=>
		{
			if(!Main.panel.statusArea.dateMenu.menu.isOpen){this._messageList.setDate(new Date()); this.resetIndicator();}
		});
	},

	filterNotifications: function()
	{
		let source=Main.messageTray.getSources()[Main.messageTray.getSources().length-1];
		if(this.prefs.get_strv("name-list").indexOf(source.title)>=0)
		switch(this.prefs.get_enum("for-list"))
		{
			case 0: 					return ;
			case 1: source.policy.destroy(); 		return ;
			case 3: source.policy.destroy();
			case 2: this.unseen--;				return ;
               	}
	},

	initTranslations:function()
	{
	    	let localeDir = Me.dir.get_child("locale");
		Gettext.bindtextdomain("notification-center", localeDir.query_exists(null) ? localeDir.get_path() : Config.LOCALEDIR );
	},

    	loadDndStatus: function ()
 	{
		this.icon.icon_name = Gtk.IconTheme.get_default().has_icon("notification-symbolic")?"notification-symbolic":"preferences-system-notifications-symbolic";
                if(this.dndpref.get_boolean("show-banners")==true)
		{
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

	manageAutohide: function()
	{
		if(this.menu.isOpen || this.prefs.get_boolean("autohide")==false ) return;

		if(this.prefs.get_boolean("show-notifications"))if(this._messageList._notificationSection._canClear()){this.actor.show();this.clearButton.show(); return;}
		if(this.prefs.get_boolean("show-media")) if(this._messageList._mediaSection._shouldShow()) {this.actor.show(); return;}
		if(this.prefs.get_boolean("show-events")){
			if(SHELL_VERSION < '3.30.0') {
				if(this._messageList._eventsSection._canClear()){this.actor.show();this.clearButton.show(); return;}}
			else {
				this._messageList._eventsSection._reloadEvents(); 
				if(this._messageList._eventsSection._shouldShow()){this.actor.show();this.clearButton.show(); return;}
			}
		}this.actor.hide();
	},

	manageEvents: function(action)
	{
		if(this.prefs.get_boolean("show-events")==false) return ;
		if(this.prefs.get_boolean("show-events-in-calendar")==true)
		switch(action)
		{
			case 0: this._messageList._removeSection(this._messageList._eventsSection); this.box.add(this._messageList._eventsSection.actor);	return;
			case 1: this.box.remove_child(this.box.get_children()[this.showingSections.length-1]);this._messageList._addSection(this._messageList._eventsSection); return;
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

    	resetIndicator: function()
	{
		this.manageAutohide();
		if(this.loadDndStatus()==false&&this.unseen>0)
		{
			this.blinkIcon();
			switch(this.prefs.get_enum("new-notification"))
			{
				case 1	: 	this.label.show(); this.label.text='• '; 			return;
				case 2	: 	this.label.show(); this.label.text=this.unseen.toString()+' '; 	return;
				default : 	this.label.hide();						return;
			}
		}

		if(this.unseen<=0)
		{
   			this.label.hide();
			this.unseen=0;
			if(this._loopTimeoutId!=null) { Mainloop.source_remove(this._loopTimeoutId); this._loopTimeoutId=null;}		
		}
	},

    	seen: function()
	{
   		if (this.menu.isOpen) 
		{
			this._messageList.setDate(new Date());
			this.manageEvents(0);
			if(this._loopTimeoutId!=null) { Mainloop.source_remove(this._loopTimeoutId); this._loopTimeoutId=null;}		
			if(this.prefs.get_boolean("show-label")==false) this.unseen=0;
            	}
		if (!this.menu.isOpen) this.manageEvents(1);
		this.resetIndicator();
        },

    	undoChanges: function () 
	{
		if(this._loopTimeoutId!=null) { Mainloop.source_remove(this._loopTimeoutId); this._loopTimeoutId=null;}		
		this.manageEvents(0);
		let len=this.showingSections.length;
                while(len!=0)
		{
			this.showingSections[len-1]._list.disconnect(this.connectedSignals[2*len-1]);
			this.showingSections[len-1]._list.disconnect(this.connectedSignals[2*len-2]);
			this.box.remove_child(this.box.get_children()[len-1]);
			this._messageList._addSection(this.showingSections[len-1]);
			this.connectedSignals.pop();this.connectedSignals.pop(); 	this.showingSections.pop(); 
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
		if(this.prefs.get_boolean("show-events")) Main.panel.statusArea.dateMenu.menu.disconnect(this.dmSig);
	},
});
