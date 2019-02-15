const ExtensionUtils = imports.misc.extensionUtils;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Me = ExtensionUtils.getCurrentExtension();
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;

function enable()
{
    	notificationCenter = new NotificationCenter();
}

function disable()
{
   	notificationCenter.destroy();
}

var 	NotificationCenter = new Lang.Class({
    	Name:		     "NotificationCenter",
    	Extends: 	     PanelMenu.Button,

    	_init: function ()
	{
		this.parent(0.5, "NotificationCenter");
		Gtk.IconTheme.get_default().append_search_path(Me.path + '/icons/');
		this.dndpref 	=  new Gio.Settings({schema_id:'org.gnome.desktop.notifications'});	
		this.prefs 	=  new Gio.Settings({	settings_schema: Gio.SettingsSchemaSource.new_from_directory(Me.path + "/schemas", 
							Gio.SettingsSchemaSource.get_default(), false).lookup(Me.metadata["settings-schema"], true) });
		this.unseen=0;
		this.detachNotificationCenter();	
		this.newMenu();

		this._indicator =  new St.BoxLayout({ vertical: false, style_class: 'panel-status-menu-box',style:"spacing:0.0em"});
        	this.icon 	=  new St.Icon({icon_name: 'notifications-symbolic',style_class:'system-status-icon'});
        	this.label 	=  new St.Label({ text: '',visible:false});
		
        	this._indicator.add_child(this.icon);
        	this._indicator.add_child(this.label);
        	this.actor.add_child(this._indicator);

		Main.panel.addToStatusArea("NotificationCenter", this, 2, this.prefs.get_string('indicator-position'));
		Main.messageTray._bannerBin.x=(this.prefs.get_enum('banner-position')-1)*(Main.layoutManager.monitors[0].width-(Main.messageTray._bannerBin.width=this.box.width));
		this.resetIndicator();
    	},

	addDndMenu: function()
	{
			this.dnditem = new PopupMenu.PopupSwitchMenuItem("Do Not Disturb");     	
                	this.menu.addMenuItem(this.dnditem);
                	this.dnditem.connect("toggled", Lang.bind(this, this.setDndState));  
	},

	blinkIcon: function()
	{
		if(this.prefs.get_boolean('blink-icon')==true)
		{ 	
			Mainloop.source_remove(this._loopTimeoutId);		
                	this.icon.icon_name=(this.icon.icon_name=='notifications-symbolic')?"dnd-symbolic":'notifications-symbolic';
			this._loopTimeoutId=Mainloop.timeout_add(1000, Lang.bind(this, this.blinkIcon));
		}
		else this.icon.icon_name='notifications-symbolic';
	},

	detachNotificationCenter: function()
	{
		this._messageList = Main.panel.statusArea.dateMenu._messageList;
        	this._messageListParent = this._messageList.actor.get_parent();
        	this._messageListParent.remove_actor(this._messageList.actor);
                this._messageList._notificationSection._list.connect('actor-added', Lang.bind(this,this.newNotif));
		this._messageList._notificationSection._list.connect('actor-removed', Lang.bind(this, this.remNotif));
		this._messageList._mediaSection._list.connect('actor-added', Lang.bind(this, this.resetIndicator));
		this._messageList._mediaSection._list.connect('actor-removed', Lang.bind(this, this.resetIndicator));   
		this._messageList._eventsSection._list.connect('actor-added', Lang.bind(this, this.resetIndicator));
		this._messageList._eventsSection._list.connect('actor-removed', Lang.bind(this, this.resetIndicator));
		this._messageList._removeSection(this._messageList._notificationSection);
		this._messageList._addSection(this._messageList._notificationSection);
                Main.panel.statusArea.dateMenu.actor.get_children()[0].remove_actor(Main.panel.statusArea.dateMenu._indicator.actor);
                Main.panel.statusArea.dateMenu.actor.get_children()[0].remove_actor(Main.panel.statusArea.dateMenu.actor.get_children()[0].get_children()[0]);
	},

    	loadDndStatus: function ()
 	{
                if(this.dndpref.get_boolean('show-banners')==true)	
		{
			this.dnditem.setToggleState(false);
			this.icon.icon_name = "notifications-symbolic";
                        Main.messageTray._bannerBin.show();       
                        return false;           
		}	 
			this.dnditem.setToggleState(true); 
			this.icon.icon_name = "dnd-symbolic";
			this.label.hide();
                       	Main.messageTray._bannerBin.hide();
	},

	newMenu: function()
	{
        	this.box 	= new St.BoxLayout({ style:"max-height: "+(0.76*Main.layoutManager.monitors[0].height)+"px;padding-bottom: 10px;"});
        	this.box.add(this._messageList.actor);
		switch(this.prefs.get_enum('dnd-position'))
		{
			case 1 : this.addDndMenu();
			case 0 : this.menu.box.add(this.box); 				break;
                        default: this.menu.box.add(this.box); this.addDndMenu();	break;
		}
		this.menu.connect("open-state-changed", Lang.bind(this, this.seen));		
	},

    	newNotif: function()
	{
                this.unseen++; 
		this.blinkIcon();
	        this.resetIndicator();
	},

    	remNotif: function()
	{
		this.unseen--;
		this.resetIndicator();
	},

    	resetIndicator: function()
	{
		if(this.prefs.get_boolean('autohide')==true)	(this._messageList._notificationSection._canClear()==false&&this._messageList._eventsSection._canClear()==false&&this._messageList._mediaSection._shouldShow()==false&&this.menu.isOpen==false)? this.actor.hide():this.actor.show();

		if(this.loadDndStatus()==false&&this.unseen>0)
		switch(this.prefs.get_enum('new-notification'))
		{
			case 1	: 	this.label.show(); this.label.text='• '; 			return;
			case 2	: 	this.label.show(); this.label.text=this.unseen.toString()+' '; 	return;
			default : 	this.label.hide();						return;
		}

		if(this.unseen<=0)
		{
   			this.label.hide();
			this.unseen=0;
			Mainloop.source_remove(this._loopTimeoutId);
		}
	},

    	seen: function()
	{
   		if (this.menu.isOpen) 
		{
			this._messageList.setDate(new Date()); 
			Mainloop.source_remove(this._loopTimeoutId);
			if(this.prefs.get_boolean('show-label')==false) this.unseen=0;
            	}	
                this.resetIndicator();
        },
        
    	setDndState: function () 
	{
 		(this.dnditem.state) ? this.dndpref.set_boolean('show-banners',false):this.dndpref.set_boolean('show-banners',true);   
	},

    	destroy: function () 
	{
		this.parent();	
        	this.box.remove_child(this._messageList.actor)
        	this._messageListParent.add_actor(this._messageList.actor);	
                Main.panel.statusArea.dateMenu.actor.get_children()[0].add_actor(Main.panel.statusArea.dateMenu._indicator.actor);
		Main.messageTray._bannerBin.show();
                Main.messageTray._bannerBin.x=0;
    	} 
});
