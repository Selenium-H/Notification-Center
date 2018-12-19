
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
    	notification = new NotificationIndicator();
    	Main.panel.addToStatusArea(notification.name, notification, 2, "right");
}

function disable() 
{
   	notification.destroy();
}




var Button = new Lang.Class({
    Name: "Button",
    Extends: PanelMenu.Button,

    _init: function (name) {
     
 	this.parent(0.0, name);

        this.box = new St.BoxLayout({
        				vertical: false,
            				style_class: "panel-status-menu-box"
        			    });;

       this.actor.add_child(this.box);
    },

    destroy: function () {
        this.parent();
    }
});

const NotificationIndicator = new Lang.Class({
    Name: "NotificationIndicator",
     Extends: Button,

    _init: function () {


        this.parent("NotificationIndicator");

        this._messageList = Main.panel.statusArea.dateMenu._messageList;

        this._messageListParent = this._messageList.actor.get_parent();
        this._messageListParent.remove_actor(this._messageList.actor);

        this._indicator = new MessagesIndicator(Main.panel.statusArea.dateMenu._indicator._sources);

        this.box.add_child(this._indicator.actor);

        this._vbox = new St.BoxLayout({

            style:"max-height: 700px;"
        });


        this._vbox.add(this._messageList.actor);
        this.menu.box.add(this._vbox);


        this.menu.connect("open-state-changed", Lang.bind(this, function (menu, isOpen) {
            if (isOpen) {
                let now = new Date();
                this._messageList.setDate(now);
            }
        }));

        this._closeButton = null;
        if (this._messageList._notificationSection._closeButton) {
            // GNOME Shell 3.20 and 3.22
            this._closeButton = this._messageList._notificationSection._closeButton;
        } else {
            // GNOME Shell 3.24
            this._closeButton = this._messageList._clearButton;
        }

        this._hideIndicator = this._closeButton.connect("notify::visible", Lang.bind(this, function (obj) {
            if (this._autoHide) {
                if (obj.visible) {
                    this.actor.show();
                } else {
                    this.actor.hide();
                }
            }
        }));

    },

    setHide: function (value) {
        this._autoHide = value
        if (!value) {
            this.actor.show();
        } else if (this._indicator._sources == "") {
            this.actor.hide();
        }
    },
    destroy: function () {
        this._closeButton.disconnect(this._hideIndicator);
        this._vbox.remove_child(this._messageList.actor)
        this._messageListParent.add_actor(this._messageList.actor);
        this.parent();
    }
});

const MessagesIndicator = new Lang.Class({
    Name: 'MessagesIndicator',

    _init: function (src) {
        Gtk.IconTheme.get_default().append_search_path(Me.dir.get_child('icons').get_path());

        this._newNotifications = "notification-new-symbolic";

        this._noNotifications = "notifications-symbolic";

        this.actor = new St.Icon({
            icon_name: this._noNotifications,
            style_class: "system-status-icon"
        });

        this._sources = src;

        Main.messageTray.connect('source-added', Lang.bind(this, this._onSourceAdded));
        Main.messageTray.connect('source-removed', Lang.bind(this, this._onSourceRemoved));
        Main.messageTray.connect('queue-changed', Lang.bind(this, this._updateCount));

        let sources = Main.messageTray.getSources();
        sources.forEach(Lang.bind(this, function (source) {
            this._onSourceAdded(null, source);
        }));
    },

    _onSourceAdded: function (tray, source) {
        source.connect('count-updated', Lang.bind(this, this._updateCount));
        this._sources.push(source);
        this._updateCount();
    },

    _onSourceRemoved: function (tray, source) {
        this._sources.splice(this._sources.indexOf(source), 1);
        this._updateCount();
    },

    _updateCount: function () {
        let count = 0;
        this._sources.forEach(Lang.bind(this,
            function (source) {
                //count += source.unseenCount;
                count += source.count;
            }));
        //count -= Main.messageTray.queueCount;

        this.actor.icon_name = (count > 0) ? this._newNotifications : this._noNotifications;
    }
});
