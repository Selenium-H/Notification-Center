const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const Panel = imports.ui.panel;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();           
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;

function init() 
{
}

function enable() 
{
    	notificationCenter=new NotificationCenter();	
}

function disable() 
{
   	notificationCenter.destroy();
}

var NotificationCenter = new Lang.Class({
    Name: "Button",
    Extends: PanelMenu.Button,

    _init: function () 
	{
      		this.parent(0.0, _("NotificationCenter"));

		Gtk.IconTheme.get_default().append_search_path(Me.path + '/icons/');

                this.count=0;
        	this._messageList = Main.panel.statusArea.dateMenu._messageList;
        	this._messageListParent = this._messageList.actor.get_parent();
        	this._messageListParent.remove_actor(this._messageList.actor);

        	this.box = new St.BoxLayout({ style:"max-height: 700px; padding: 0px;"});
        	this.box.add(this._messageList.actor);
        	this.menu.box.add(this.box);

                this._indicator = new St.Icon({
            						icon_name: "notifications-symbolic",
      							style_class: "system-status-icon"
       				      	      });

       		this.actor.add_child(this._indicator);
		Main.panel.addToStatusArea("NotificationCenter", this, 2, "right");   
 	
		this.menu.connect("open-state-changed", Lang.bind(this, this._seen));
       		Main.messageTray.connect('source-added', Lang.bind(this, this._newNotif));
       		Main.messageTray.connect('source-removed', Lang.bind(this, this._remNotif));				               	                                  
		//Main.panel.statusArea.dateMenu._indicator.actor.get_children()[0].hide();	// Removes Notification Dot from Date Time Menu

		this.dndpref = new Gio.Settings({ schema_id:'org.gnome.desktop.notifications' });	// Loads DND preferences
                this.dnditem = new PopupMenu.PopupSwitchMenuItem("Do Not Disturb");        	
   	        this._loadDndStatus(this.dnditem);
                this.menu.addMenuItem(this.dnditem);
                this.dnditem.connect("toggled", Lang.bind(this, this._setDndState));  
    	},

    _loadDndStatus: function (dnditem)
 	{
                if(this.dndpref.get_boolean('show-banners')==true)	
		{
			dnditem.setToggleState(false);
                        Main.messageTray._bannerBin.show();                   
		}
        	 
        	else
		{
			dnditem.setToggleState(true); 
                        Main.messageTray._bannerBin.hide();
		}
	},

    _setDndState: function () 
	{
 		if(this.dnditem.state)	
		{
			this.dndpref.set_boolean('show-banners',false);
                        Main.messageTray._bannerBin.hide();
		}

		else
		{
			this.dndpref.set_boolean('show-banners',true);
                        Main.messageTray._bannerBin.show();       
		}
	},

    _seen: function()
	{
   		if (this.menu.isOpen) 
		{
			this._messageList.setDate(new Date()); 
             	     	this._indicator.icon_name="notifications-symbolic";
            	}
        },

    _newNotif: function()
	{
         	this._indicator.icon_name = "notification-new-symbolic" ;   
                this.count++;
	},

    _remNotif: function()
	{	
		this.count--;
                this._indicator.icon_name = (this.count> 0) ? "notification-new-symbolic" : "notifications-symbolic" ;
	},

    destroy: function () 
	{
        	this.box.remove_child(this._messageList.actor)
        	this._messageListParent.add_actor(this._messageList.actor);
        	this.parent();
        	//Main.panel.statusArea.dateMenu._indicator.actor.get_children()[0].show();		
		Main.messageTray._bannerBin.show();
                Main.messageTray._bannerBin.x=0;
    	} 
});
