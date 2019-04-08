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

function enable()
{
    	notificationCenter = new NotificationCenter();
}

function disable()
{
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
   		this.initTranslations();
		this.connectedSignals = [];
		this.showingSections  = [];
		this.unseen = 0;

		this.parent(1-0.5*this.prefs.get_enum('indicator-pos'), "NotificationCenter");	
		this.buildNotificationCenter();
		
        	this.icon 	=  new St.Icon({style_class:'system-status-icon'});
        	this.label 	=  new St.Label({ text: '',visible:false});
		this._indicator =  new St.BoxLayout({ vertical: false, style_class: 'panel-status-menu-box',style:"spacing:0.0em"});
        	this._indicator.add_child(this.icon);
        	this._indicator.add_child(this.label);

        	this.actor.add_child(this._indicator);
		Main.panel.addToStatusArea("NotificationCenter", this, 2, this.prefs.get_string('indicator-pos'));
		Main.messageTray._bannerBin.x=(this.prefs.get_enum('banner-pos')-1)*(Main.layoutManager.monitors[0].width-(Main.messageTray._bannerBin.width=this.box.width));
		this.resetIndicator();
    	},

	addClearButton: function()
	{
        	    this.clearButton = new St.Button({style_class: 'message-list-clear-button button',label: _("Clear All"),can_focus: true});
        	    this.clearButton.set_x_align(1+this.prefs.get_enum('clear-button-alignment'));
                    this.clearButton.connect('clicked',Lang.bind(this,function(){ this._messageList._notificationSection.clear(); this._messageList._eventsSection.clear(); }));
        	    this.menu.box.add(this.clearButton);
		    this.menu.addMenuItem(new PopupMenu.PopupBaseMenuItem({activate: false,hover: false}));
	},

	addDndMenu: function()
	{
		this.dnditem = new PopupMenu.PopupSwitchMenuItem(_("Do Not Disturb"));     
		this.dnditem.connect("toggled", Lang.bind(this, this.setDndState));  	
               	this.menu.addMenuItem(this.dnditem);
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
		if(this.prefs.get_boolean('blink-icon')==true)
		{
			Mainloop.source_remove(this._loopTimeoutId);
			this.icon.set_opacity((this.icon.get_opacity()==255)? 100 : 255);
			this._loopTimeoutId=Mainloop.timeout_add(this.prefs.get_int('blink-time'), Lang.bind(this, this.blinkIcon));
		}
	},

	buildNotificationCenter: function()
	{
		this._messageList = Main.panel.statusArea.dateMenu._messageList;
		this.box = new St.BoxLayout({ vertical: true});
		this.scrollView = new St.ScrollView({ style:"padding: 15px; padding-bottom: 0px; min-width:"+ this._messageList.actor.width+"px; max-width:" 										+0.2*Main.layoutManager.monitors[0].width + "px;", hscrollbar_policy: 2, x_fill: true, y_fill: true});
 		this.scrollView.add_actor(this.box);
		this.addThisSection(this._messageList._mediaSection	   ,"show-media"	 ,1);
		this.addThisSection(this._messageList._notificationSection ,"show-notifications" ,0);
		this.addThisSection(this._messageList._eventsSection 	   ,"show-events" 	 ,1);
		this.manageEvents(1);

		switch(this.prefs.get_enum('dnd-position'))
		{
			case 1 : this.addDndMenu();
			case 0 : this.menu.box.add(this.scrollView); this.addClearButton();  				break;
                        default: this.menu.box.add(this.scrollView); this.addClearButton(); this.addDndMenu(this.menu);	break;
		}
		this.menu.connect("open-state-changed", Lang.bind(this, this.seen));
		Main.panel.statusArea.dateMenu.actor.get_children()[0].remove_actor(Main.panel.statusArea.dateMenu._indicator.actor);	
	},

	filterNotifications: function()
	{
		let source=Main.messageTray.getSources()[Main.messageTray.getSources().length-1];
		if(this.prefs.get_strv('name-list').indexOf(source.title)>=0)
		switch(this.prefs.get_enum('for-list'))
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
                if(this.dndpref.get_boolean('show-banners')==true)
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

	manageEvents: function(action)
	{
		if(this.prefs.get_boolean('show-events')==false) return ;
		if(this.prefs.get_boolean("show-events-in-calendar")==true)
		switch(action)
		{
			case 0: this._messageList._removeSection(this._messageList._eventsSection); this.box.add(this._messageList._eventsSection.actor);	return;
			case 1: this.box.remove_child(this.box.get_children()[2]); this._messageList._addSection(this._messageList._eventsSection);		return;
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
		if(this._messageList._notificationSection._canClear() == false && this._messageList._eventsSection._canClear() == false &&
		   this._messageList._mediaSection._shouldShow() == false )
		{
			this.clearButton.hide();
			if(this.prefs.get_boolean('autohide') == true && this.menu.isOpen == false) this.actor.hide();
		}
		else 
		{
			this.actor.show();
			this.clearButton.show();
		}

		if(this.loadDndStatus()==false&&this.unseen>0)
		{
			this.blinkIcon();
			switch(this.prefs.get_enum('new-notification'))
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
			Mainloop.source_remove(this._loopTimeoutId);
		}
	},

    	seen: function()
	{
   		if (this.menu.isOpen) 
		{
			this._messageList.setDate(new Date()); 
			this.manageEvents(0);
			Mainloop.source_remove(this._loopTimeoutId);
			if(this.prefs.get_boolean('show-label')==false) this.unseen=0;
            	}
		if (!this.menu.isOpen) this.manageEvents(1);
		this.resetIndicator();
        },
        
    	setDndState: function () 
	{
 		(this.dnditem.state) ? this.dndpref.set_boolean('show-banners',false):this.dndpref.set_boolean('show-banners',true);   
	},

    	destroy: function () 
	{
		this.manageEvents(0);
		len=this.showingSections.length;
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
		this.parent();
	},
});
