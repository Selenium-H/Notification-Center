//Version 14

const Config = imports.misc.config;
const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Metadata = Extension.metadata;
const _ = Gettext.domain("notification-center").gettext;

function init()
{
	initTranslations()
}

function buildPrefsWidget() 
{
	let widget 	=  new NotificationCenterPrefs();
    	let switcher 	=  new Gtk.StackSwitcher({halign: Gtk.Align.CENTER, visible: true, stack: widget});
    	Mainloop.timeout_add(0, () => {	widget.get_toplevel().get_titlebar().custom_title = switcher;	return false; });
    	widget.show_all();

   	return widget;
}

const 	NotificationCenterPrefs = new GObject.Class({
    	Name: 		'NotificationCenterPrefs',
    	Extends: 	Gtk.Stack,
    
    	_init: function() 
	{
        	this.parent({ transition_type: 0, transition_duration: 500 });
        	this.add_titled(new Prefs1(1)		,'Notifications',_('Notifications'));
        	this.add_titled(new Prefs1(2)		,'Indicator'	,_('Indicator'    ));
        	this.add_titled(new AppsListPrefs()	,'List'		,_('List'         ));
       		this.add_titled(new AboutPage()	        ,'About'	,_('About'        ));
    	}
});

const 	Prefs1 = 	new GObject.Class({
    	Name: 		'Prefs1',

    	_init: function(page) 
	{
	 	let settings	= new Gio.Settings({ 	settings_schema: Gio.SettingsSchemaSource.new_from_directory(Extension.path + "/schemas", 								Gio.SettingsSchemaSource.get_default(), false).lookup(Extension.metadata['settings-schema'], true) });
    		this.grid 	= new Gtk.Grid({ column_spacing: 80, halign: Gtk.Align.CENTER, margin: 20, row_spacing: 20,border_width:20 });
		switch(page)
		{	
		    case 1 :this.prefSwitch(_('Show Media Section on Notification Center')     ,"show-media"	     	     ,0 		,settings);
			    this.prefSwitch(_('Show Notification List on Notification Center') ,"show-notifications"	     ,1 		,settings);
	 	    	    this.prefSwitch(_('Show Events List on Notification Center')       ,"show-events"		     ,2 		,settings);
			    this.prefSwitch(_('Keep Events List besides Calendar')             ,"show-events-in-calendar"    ,3 		,settings);
			    this.prefCombo (_('Show Do Not Disturb menu entry ') ,'dnd-position'			     ,4 
					    ,['none','top','bottom'] 		,[_("Don't Show"),_('On Top'),_('At Bottom')] 			,settings);
			    this.prefCombo (_('Clear All Button position ')	 ,'clear-button-alignment'		     ,5 
					    ,['left','center','right','hide'] 	,[_('Left'),_('Center'),_('Right'),_("Don't Show")] 		,settings);
			    this.prefCombo (_('Notification Banner position')    ,'banner-pos' 				     ,6 
					    ,['left','center','right' ] 	,[_('Left'),_('Center'),_('Right')] 				,settings);
			    this.prefTime  (_('Maximum height of Notification Center ( in % )')	,'max-height'	     	     ,7	,20,100,1 	,settings);
			    break;
		    case 2 :this.prefCombo (_('Notification Center indicator position'),'indicator-pos' 		     ,0 
					    ,['left','center','right'] 		,[_('Left'),_('Center'),_('Right')] 				,settings);
			    this.prefSwitch(_('AutoHide notification indicator on panel')		,'autohide'	     ,1 		,settings);
			    this.prefCombo (_('When new notification arrives'),'new-notification'			     ,2
					    ,['none','dot','count']		,[_('Show Nothing'),_('Show Dot'),_('Show Count')] 		,settings); 
   	        	    this.prefSwitch(_('Blink bell icon on new notifications ')	   	        ,'blink-icon'	     ,3 		,settings);
	        	    this.prefTime  (_('Blink Time Interval     ( in milliseconds )')		,'blink-time'	     ,4	,100,10000,10 	,settings);
	        	    this.prefSwitch(_('Show Dots or Counts till all notifications are cleared') ,'show-label'	     ,5 		,settings);
		    default:break;
		}
		return this.grid;
	},

	prefCombo: function(LABEL,KEY,pos,options,items ,settings)
	{
		let SettingLabel 	= new Gtk.Label({xalign: 1, label: LABEL,halign: Gtk.Align.START });
		let SettingCombo 	= new Gtk.ComboBoxText();
		for (let i=0;i<options.length;i++) SettingCombo.append(options[i], 	items[i]);
            	SettingCombo.set_active(options.indexOf(settings.get_string(KEY)));
            	SettingCombo.connect('changed', Lang.bind (this, function(widget) {settings.set_string(KEY, options[widget.get_active()]);  }));
		this.grid.attach(SettingLabel,      0, pos, 1, 1);
		this.grid.attach(SettingCombo,      2, pos, 3, 1);
	},

	prefTime: function(LABEL,KEY,pos,mn,mx,st ,settings) 
	{
		let SettingLabel 	= new Gtk.Label({ xalign: 1, label: LABEL,halign: Gtk.Align.START });
    		let timeSetting = Gtk.SpinButton.new_with_range(mn,mx,st);
  		timeSetting.set_value(settings.get_int(KEY));
  		timeSetting.connect('notify::value', function(spin){ settings.set_int(KEY,spin.get_value_as_int()); });
    		this.grid.attach(SettingLabel    ,0, pos, 1,  1);
		this.grid.attach(timeSetting     ,2, pos, 3,  1);
	},

	prefSwitch: function(LABEL,KEY,pos ,settings)
	{
		let SettingLabel 	= new Gtk.Label({ xalign: 1, label: LABEL,halign: Gtk.Align.START });
    		let SettingSwitch 	= new Gtk.Switch({hexpand: false,active: settings.get_boolean(KEY),halign:Gtk.Align.END});
    		SettingSwitch.connect("notify::active", function(button) {settings.set_boolean(KEY, button.active);});		
    		this.grid.attach(SettingLabel,      0, pos, 1, 1);
		this.grid.attach(SettingSwitch,     2, pos, 3, 1);
	},
});


const 	AppsListPrefs = new GObject.Class({
  	Name: 		'AppsListPrefs',
  	Extends: 	Gtk.Grid,

  	_init: function() 
	{
    		this.parent();
    		this.settings = new Gio.Settings({ 	settings_schema: Gio.SettingsSchemaSource.new_from_directory(Extension.path + "/schemas", 						    		Gio.SettingsSchemaSource.get_default(), false).lookup(Extension.metadata["settings-schema"], true) });
		this.makeList();
		this.showPrefs();
    		this.refreshList();
  	},

  	addApp: function() 
	{
    		let dialog 		= new Gtk.Dialog({ title: _('Choose an application'),transient_for: this.get_toplevel(),use_header_bar: true,modal: true });
		dialog._appChooser 	= new Gtk.AppChooserWidget({ show_all: true });
		dialog.set_default_response(Gtk.ResponseType.OK);
    		dialog.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL);
    		let addButton 		= dialog.add_button("Add", Gtk.ResponseType.OK);
    		let hbox 		= new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,margin: 5});
    		hbox.pack_start(dialog._appChooser, true, true, 0);
    		dialog.get_content_area().pack_start(hbox, true, true, 0);
    		dialog.connect('response', Lang.bind(this, function(dialog, id) 
		{
      			if (id != Gtk.ResponseType.OK) 
			{
        			dialog.destroy();
        			return;
      			}

      			let appInfo = dialog._appChooser.get_app_info();
      			if (!appInfo) return;

			let appsList = this.settings.get_strv('list');
			let nameList = this.settings.get_strv('name-list');
      			if (appsList.indexOf(appInfo.get_id())>=0)
			{
        			dialog.destroy();
        			return;
      			}
      			appsList.push(appInfo.get_id());
			nameList.push(appInfo.get_name());
			this.settings.set_strv('list', appsList);
			this.settings.set_strv('name-list', nameList);
      			this._store.set(this._store.append(),[0, 2, 1],[appInfo, appInfo.get_icon(), appInfo.get_name()]);

     		 	dialog.destroy();
      		}));
    		dialog.show_all();
  	},

	makeList: function()
	{
		this._store = new Gtk.ListStore();
    		this._store.set_column_types([Gio.AppInfo, GObject.TYPE_STRING, Gio.Icon]);

		let iconRenderer = new Gtk.CellRendererPixbuf;
		let nameRenderer = new Gtk.CellRendererText;
    		let appColumn 	 = new Gtk.TreeViewColumn({expand: true, resizable:true,alignment: 0.5,sort_column_id: 1,title:_("Application List")});
		appColumn.set_fixed_width(324);
    		appColumn.pack_start(iconRenderer, false);
    		appColumn.pack_start(nameRenderer, true);
    		appColumn.add_attribute(iconRenderer, "gicon"  ,2);
    		appColumn.add_attribute(nameRenderer, "text"   ,1);
		this.treeView = new Gtk.TreeView({ model: this._store,hexpand: true,vexpand: true ,halign: Gtk.Align.CENTER});
    		this.treeView.append_column(appColumn);
		let listBox   = new Gtk.ScrolledWindow({ shadow_type: Gtk.ShadowType.IN});
		listBox.add(this.treeView);
		this.attach(listBox,0,0,1,1);
	},

	prefCombo: function(LABEL,KEY,pos,options,items,box)
	{
		let SettingLabel 	= new Gtk.Label({xalign: 1, label: LABEL,halign: Gtk.Align.CENTER });
		let SettingCombo 	= new Gtk.ComboBoxText({});
        	SettingCombo.append(options[0], 	items[0]);
        	SettingCombo.append(options[1], 	items[1]);
        	SettingCombo.append(options[2], 	items[2]);
        	SettingCombo.append(options[3], 	items[3]);		
            	SettingCombo.set_active(options.indexOf(this.settings.get_string(KEY)));
            	SettingCombo.connect('changed', Lang.bind (this, function(widget) {this.settings.set_string(KEY, options[widget.get_active()]);  }));
		box.attach(SettingLabel,0,pos,1,1);
		box.attach(SettingCombo,0,pos+1,1,1);
	},

  	refreshList: function() 
	{
    		this._store.clear();
    		let appsList = this.settings.get_strv('list');
		let nameList = this.settings.get_strv('name-list');

    		for (let i = 0; i < nameList.length; i++) 
		{
      			let appInfo = Gio.DesktopAppInfo.new(appsList[i]);
			if(Gio.DesktopAppInfo.new(appsList[i])==null)
			{
        			appsList.splice(i,1);
				nameList.splice(i,1);
				i--;
			}
			else	this._store.set(this._store.append(),[0, 2, 1],[appInfo, appInfo.get_icon(), nameList[i]]);
    		}
        	this.settings.set_strv('list',appsList);
		this.settings.set_strv('name-list', nameList);
  	},

  	removeApp: function() 
	{
    		let [any, model, iter] = this.treeView.get_selection().get_selected();
		let appsList = this.settings.get_strv('list');
		let nameList = this.settings.get_strv('name-list');

    		if (any) 
		{
      			let indx,appInfo = this._store.get_value(iter, 0); 
      			appsList.splice((indx=appsList.indexOf(appInfo.get_id())),1);
			nameList.splice(indx,1);
			this.settings.set_strv('list',appsList);
			this.settings.set_strv('name-list', nameList);
      			this._store.remove(iter);
    		}
  	},

	showPrefs: function()
{
		let box = new Gtk.Grid({ column_spacing: 20, halign: Gtk.Align.CENTER, margin: 20, row_spacing: 20 });

		this.prefCombo(_('If new notification arrives for apps on this list'),'for-list',1,['none','count','banner','both'], 							[_('Show them'),_('Show counts only'),_('Show banner only'),_('Ignore them')],box);
    		let addButton = new Gtk.Button({label: _("     Add    "),halign:Gtk.Align.START});
    		addButton.connect('clicked', Lang.bind(this, this.addApp));
      		box.attach(addButton,0,0,1,1);

let delButton = new Gtk.Button({label: _(" Remove "),halign:Gtk.Align.END});
      		delButton.connect('clicked', Lang.bind(this, this.removeApp));
      		box.attach(delButton,0,0,1,1);
		this.attach(box,1,0,1,1); 
	}
});

const	AboutPage = 	new GObject.Class({
    	Name: 		'AboutPage',
    	Extends: 	Gtk.ScrolledWindow,

    	_init: function(params) 
	{
        	this.parent();
        
        	let vbox	= new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, margin: 30 });
        	let imageBox	= new Gtk.Box();
        	let image 	= new Gtk.Image({ file: Extension.dir.get_child('eicon.png').get_path(), pixel_size: 96 });
       	 	let textBox	= new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        	let text 	= new Gtk.Label({ wrap: true, justify: 2, use_markup: true,
                                  		  label: "<big><b>" + Metadata.name + "</b></big>" + "\n" +"<small>Version" + " " + Metadata.version +"</small>\n\n" +
                                         	  (Metadata.description) + "\n\n\n\n\n\n" +"<span size=\"small\">This program comes with ABSOLUTELY NO WARRANTY.\nSee the "+ 						  	  "<a href=\"https://www.gnu.org/licenses/old-licenses/gpl-2.0.html\">GNU General Public License, version 2 or later</a>"+ 	 							  "for details.</span>"+ "\n" });
		imageBox.set_center_widget(image);
        	vbox.pack_start(imageBox, false, false, 0);
        	textBox.pack_start(text, false, false, 0);
        	vbox.pack_start(textBox, false, false, 0);
		this.add(vbox);
    	}  
});

function initTranslations()
{
    	let localeDir = Extension.dir.get_child("locale");
	Gettext.bindtextdomain("notification-center", localeDir.query_exists(null)?localeDir.get_path():Config.LOCALEDIR);
}
