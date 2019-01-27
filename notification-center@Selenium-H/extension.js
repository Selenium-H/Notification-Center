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
		Gtk.IconTheme.get_default().append_search_path(Me.path + '/icons/');
		this.count=0;

      		this.parent(0.0, _("NotificationCenter"));
        	this._messageList = Main.panel.statusArea.dateMenu._messageList;
        	this._messageListParent = this._messageList.actor.get_parent();
        	this._messageListParent.remove_actor(this._messageList.actor);

        	this.box = new St.BoxLayout({ style:"max-height: 700px; padding: 0px;"});
        	this.box.add(this._messageList.actor);
            	this._messageList._removeSection(this._messageList._notificationSection);
		this._messageList._addSection(this._messageList._notificationSection);

        	this.menu.box.add(this.box);
                this._indicator = new St.Icon({
            						icon_name: "notifications-symbolic",
      							style_class: "system-status-icon"
       				      	      });

       		this.actor.add_child(this._indicator);
		Main.panel.addToStatusArea("NotificationCenter", this, 2, "right");   
                
		this.dndpref = new Gio.Settings({ schema_id:'org.gnome.desktop.notifications' });
                this.dnditem = new PopupMenu.PopupSwitchMenuItem("Do Not Disturb");        	
                this.menu.addMenuItem(this.dnditem);

       		Main.messageTray.connect('source-added', Lang.bind(this, this._newNotif));
       		Main.messageTray.connect('source-removed', Lang.bind(this, this._remNotif));
		this._messageList._mediaSection._list.connect('actor-added', Lang.bind(this, this._autohideIcon));
		this._messageList._mediaSection._list.connect('actor-removed', Lang.bind(this, this._autohideIcon));   
		this._messageList._eventsSection._list.connect('actor-added', Lang.bind(this, this._autohideIcon));
		this._messageList._eventsSection._list.connect('actor-removed', Lang.bind(this, this._autohideIcon));

		this.menu.connect("open-state-changed", Lang.bind(this, this._seen));
                this.dnditem.connect("toggled", Lang.bind(this, this._setDndState));  

		this._autohideIcon();
    	},

    _loadDndStatus: function (dnditem)
 	{
                if(this.dndpref.get_boolean('show-banners')==true)	
		{
			dnditem.setToggleState(false);
                        Main.messageTray._bannerBin.show();       
                        return false;           
		}	 
        	else
		{
			dnditem.setToggleState(true); 
			this._indicator.icon_name = "dnd-symbolic";
                       	Main.messageTray._bannerBin.hide();
                       return true;
		}
	},

    _setDndState: function () 
	{
 		if(this.dnditem.state)		this.dndpref.set_boolean('show-banners',false);

		else				this.dndpref.set_boolean('show-banners',true);   
	},

    _seen: function()
	{
   		if (this.menu.isOpen) 
		{
			this._messageList.setDate(new Date());
                        this.count=0;
            	}
                this._autohideIcon();
        },

    _newNotif: function()
	{
                this.count++;
	        this._autohideIcon();
	},

    _remNotif: function()
	{	
		this.count--;
		this._autohideIcon();
	},

    _autohideIcon: function()
	{
		if(this._loadDndStatus(this.dnditem)==false)	this._indicator.icon_name = (this.count<=0 ) ? "notifications-symbolic":"new-notif-symbolic" ;
		
		if(this._messageList._notificationSection._canClear()==false&&this._messageList._eventsSection._canClear()==false&&this._messageList._mediaSection._shouldShow()==false&&this.menu.isOpen==false&&this.count<=0)  
		{
			this.actor.hide();
			this.count=0;
		}
                else this.actor.show();
	},

    destroy: function () 
	{
        	this.box.remove_child(this._messageList.actor)
        	this._messageListParent.add_actor(this._messageList.actor);
        	this.parent();		
		Main.messageTray._bannerBin.show();
                Main.messageTray._bannerBin.x=0;
    	} 
});
