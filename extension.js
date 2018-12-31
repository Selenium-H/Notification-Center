
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const Panel = imports.ui.panel;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();           
const Gtk = imports.gi.Gtk;

let notfication;

function init() 
{
}

function enable() 
{
    	notificationCenter = new NotificationCenter();
    	Main.panel.addToStatusArea(notificationCenter.name, notificationCenter, 2, "right");
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
                
        	this._messageList = Main.panel.statusArea.dateMenu._messageList;
        	this._messageListParent = this._messageList.actor.get_parent();
        	this._messageListParent.remove_actor(this._messageList.actor);

        	this.box = new St.BoxLayout({ style:"max-height: 700px;"});
        	this.box.add(this._messageList.actor);
        	this.menu.box.add(this.box);

                this._indicator = new St.Icon({
            					icon_name:"notifications-symbolic",
            					style_class: "system-status-icon"
        				      });

       		this.actor.add_child(this._indicator);
  
        	//Main.panel.statusArea.dateMenu._indicator.actor.get_children()[0].hide();   
                
        	Main.messageTray.connect('source-added', Lang.bind(this, this._newNotif));
        	Main.messageTray.connect('source-removed', Lang.bind(this, this._updateCount));
        	Main.messageTray.connect('queue-changed', Lang.bind(this, this._updateCount));
         
                this.menu.connect("open-state-changed", Lang.bind(this, this._seen));
    	},

    _seen: function()
	{
   		if (this.menu.isOpen) 
		{
             	     	this._indicator.icon_name="notifications-symbolic";
                	this._messageList.setDate(new Date()); 
            	}
        },

    _newNotif: function()
	{
         	this._indicator.icon_name = "notifications-new-symbolic" ;   
	},

    _updateCount: function () 
	{
               	this._indicator.icon_name = (count=this.messageList.length > 0) ? "notifications-new-symbolic" : "notifications-symbolic" ;
    	},

    destroy: function () 
	{
        	this.box.remove_child(this._messageList.actor)
        	this._messageListParent.add_actor(this._messageList.actor);
        	this.parent();
        	//Main.panel.statusArea.dateMenu._indicator.actor.get_children()[0].show(); Brings back Notification dot
    	} 
});
