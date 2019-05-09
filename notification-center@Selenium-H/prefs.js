//Version 16

const Config = imports.misc.config;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Metadata = Me.metadata;
const _ = Gettext.domain("notification-center").gettext;

let settings = null;

function init() {
  Convenience.initTranslations("notification-center");
  settings = Convenience.getSettings("org.gnome.shell.extensions.notification-center");
}

function buildPrefsWidget() {
  let widget = new NotificationCenterPrefs();
  let switcher = new Gtk.StackSwitcher({halign: Gtk.Align.CENTER, visible: true, stack: widget});
  Mainloop.timeout_add(0, () => {
    widget.get_toplevel().get_titlebar().custom_title = switcher;
    return false;
  });

  widget.show_all();
  return widget;
}

const NotificationCenterPrefs = new GObject.Class({
  Name: 'NotificationCenterPrefs',
  Extends: Gtk.Stack,
    
  _init: function() {
    this.parent({ transition_type: 0, transition_duration: 500 });
    this.add_titled(new Prefs1(1), 'Notifications',_('Notifications'));
    this.add_titled(new Prefs1(2), 'Indicator',_('Indicator'));
    this.add_titled(new AppsListPrefs(), 'List',_('List'));
    this.add_titled(new AboutPage(),'About',_('About'));
  }
});

const Prefs1 =  new GObject.Class({
  Name: 'Prefs1',

  _init: function(page) {
    
    this.grid = new Gtk.Grid({ column_spacing: 80, halign: Gtk.Align.CENTER, margin: 20, row_spacing: 20,border_width:20 });
    switch (page) {
        case 1 :
          this.prefSwitch("show-media", 0);
          this.prefSwitch("show-notifications", 1);
          this.prefSwitch("show-events", 2);
          this.prefSwitch("show-events-in-calendar", 3);
          this.prefCombo ('dnd-position', 4, ['none','top','bottom'], [_("Don't Show"), _('On Top'), _('At Bottom')]);
          this.prefCombo ('clear-button-alignment', 5, ['left','center','right','hide'], [_('Left'), _('Center'), _('Right'), _("Don't Show")]);
          this.prefCombo ('banner-pos', 6, ['left','center','right' ], [_('Left'), _('Center'), _('Right')]);
          this.prefTime  ('max-height', 7, 20, 100, 1);
          break;
        case 2:
          this.prefCombo ('indicator-pos', 0, ['left','center','right'], [_('Left'), _('Center'), _('Right')]);
          this.prefSwitch('individual-icons', 1);
          this.prefSwitch('autohide', 2);
          this.prefStr('indicator-shortcut', 3, ['<Alt>', '<Ctrl>', '<Shift>', '<Super>'], [_('Alt Key'), _('Ctrl Key'), _('Shift Key'), _('Super Key')]);
          this.prefCombo('new-notification', 4, ['none', 'dot', 'count'], [_('Show Nothing'), _('Show Dot'), _('Show Count')]);
          this.prefSwitch('include-events-count', 5);
          this.prefSwitch('blink-icon', 6);
          this.prefTime ('blink-time', 7, 100, 10000, 10);
          this.prefSwitch('show-label', 8);
          this.prefSwitch('middle-click-dnd'  ,9);
        default:
          break;
    }
    return this.grid;
},

 attachLabel: function(KEY,pos) {
   let prefLabel = new Gtk.Label({xalign: 1, label: _(settings.settings_schema.get_key(KEY).get_description()), halign: Gtk.Align.START});
   this.grid.attach(prefLabel,0,pos,1,1);
 },
  
 prefCombo: function(KEY, pos, options, items) {
    let SettingCombo = new Gtk.ComboBoxText();
    for (let i = 0; i < options.length; i++) {
      SettingCombo.append(options[i],  items[i]);
    }
    SettingCombo.set_active(options.indexOf(settings.get_string(KEY)));
    SettingCombo.connect('changed', Lang.bind(this, function(widget) {
      settings.set_string(KEY, options[widget.get_active()]);
      this.reloadExtension();
    }));
    
    this.attachLabel(KEY,pos);
    this.grid.attach(SettingCombo, 2, pos, 3, 1);
  },

  prefStr: function(KEY, pos, options, items) {
    let SettingCombo  = new Gtk.ComboBoxText();
    
    for (let i=0;i<options.length;i++) {
      SettingCombo.append(options[i],   items[i]);
    }
    
    let keyVal=settings.get_strv(KEY);
    let strSetting = new Gtk.Entry({text:keyVal[0].substring(1+keyVal[0].indexOf('>'))});
    let box = new Gtk.Box({halign:Gtk.Align.END});
    
    strSetting.set_width_chars(1);
    SettingCombo.set_active(options.indexOf(keyVal[0].substring(0,1+keyVal[0].indexOf('>'))));
    SettingCombo.connect('changed', Lang.bind (this, function(widget) {  
      keyVal.pop(); 
      keyVal.push(options[widget.get_active()]+strSetting.text);
      settings.set_strv(KEY,keyVal);
    }));
    
    strSetting.connect('changed'  , Lang.bind (this, function()  {  
      keyVal.pop(); 
      keyVal.push(options[SettingCombo.get_active()]+strSetting.text);
      settings.set_strv(KEY,keyVal);
    }));
    
    box.add(SettingCombo);
    box.add(new Gtk.Label({label: "  +  "}));
    box.add(strSetting);
    
    this.attachLabel(KEY,pos);
    this.grid.attach(box    ,2, pos, 3,  1);
  },

  prefTime: function(KEY, pos, mn, mx, st) {
    let timeSetting = Gtk.SpinButton.new_with_range(mn, mx, st);
    timeSetting.set_value(settings.get_int(KEY));
    timeSetting.connect('notify::value', function(spin) {
      settings.set_int(KEY,spin.get_value_as_int());
    });

    this.attachLabel(KEY,pos);
    this.grid.attach(timeSetting, 2, pos, 3, 1);
  },

  prefSwitch: function(KEY, pos) {
    let SettingSwitch = new Gtk.Switch({hexpand: false, active: settings.get_boolean(KEY), halign: Gtk.Align.END});
    SettingSwitch.connect("notify::active", Lang.bind(this, function(button) {
      settings.set_boolean(KEY, button.active);
      this.reloadExtension();
    }));
    this.attachLabel(KEY,pos);
    this.grid.attach(SettingSwitch, 2, pos, 3, 1);
  },
  
  reloadExtension: function() {
    (settings.get_boolean("reload-signal"))?settings.set_boolean("reload-signal", false):settings.set_boolean("reload-signal", true);
  },
});


const AppsListPrefs = new GObject.Class({
  Name: 'AppsListPrefs',
  Extends: Gtk.Grid,

  _init: function() {
    this.parent();
    this.makeList();
    this.showPrefs();
    this.refreshList();
  },


  attachLabel: function(KEY,pos,box) {
    let prefLabel = new Gtk.Label({xalign: 1, label: _(settings.settings_schema.get_key(KEY).get_description()), halign: Gtk.Align.START});
    box.attach(prefLabel,0,pos,1,1);
  },
 
  addApp: function()  {
    let dialog = new Gtk.Dialog({ title: _('Choose an application'),transient_for: this.get_toplevel(),use_header_bar: true,modal: true });
    dialog._appChooser = new Gtk.AppChooserWidget({ show_all: true });
    dialog.set_default_response(Gtk.ResponseType.OK);
    dialog.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL);
    let addButton = dialog.add_button("Add", Gtk.ResponseType.OK);
    let hbox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,margin: 5});
    hbox.pack_start(dialog._appChooser, true, true, 0);
    dialog.get_content_area().pack_start(hbox, true, true, 0);
    dialog.connect('response', Lang.bind(this, function(dialog, id) {
      if (id != Gtk.ResponseType.OK) {
              dialog.destroy();
              return;
      }

      let appInfo = dialog._appChooser.get_app_info();
      if (!appInfo) {
        return;
      }

      let appsList = settings.get_strv('list');
      let nameList = settings.get_strv('name-list');
      if (appsList.indexOf(appInfo.get_id())>=0) {
        dialog.destroy();
        return;
      }
      appsList.push(appInfo.get_id());
      nameList.push(appInfo.get_name());
      settings.set_strv('list', appsList);
      settings.set_strv('name-list', nameList);
      this._store.set(this._store.append(),[0, 2, 1],[appInfo, appInfo.get_icon(), appInfo.get_name()]);

      dialog.destroy();
    }));
    
    dialog.show_all();
  },

  makeList: function() {
    this._store = new Gtk.ListStore();
    this._store.set_column_types([Gio.AppInfo, GObject.TYPE_STRING, Gio.Icon]);
    this.treeView = new Gtk.TreeView({ model: this._store,hexpand: true,vexpand: true ,halign: Gtk.Align.START});

    let iconRenderer = new Gtk.CellRendererPixbuf;
    let nameRenderer = new Gtk.CellRendererText;
    let appColumn    = new Gtk.TreeViewColumn({expand: true, resizable:true,alignment: 0.5,sort_column_id: 1,title:_("Application List")});
    let listBox   = new Gtk.ScrolledWindow({hexpand: true, shadow_type: Gtk.ShadowType.IN});
    
    appColumn.pack_start(iconRenderer, false);
    appColumn.pack_start(nameRenderer, true);
    appColumn.add_attribute(iconRenderer, "gicon"  ,2);
    appColumn.add_attribute(nameRenderer, "text"   ,1);
    
    this.treeView.append_column(appColumn);
    appColumn.set_fixed_width(350);
    listBox.add(this.treeView);
    this.attach(listBox,0,0,1,1);
  },

 prefCombo: function(KEY, pos, options, items,box) {
    let SettingCombo = new Gtk.ComboBoxText();
    for (let i = 0; i < options.length; i++) {
      SettingCombo.append(options[i],  items[i]);
    }
    SettingCombo.set_active(options.indexOf(settings.get_string(KEY)));
    SettingCombo.connect('changed', Lang.bind(this, function(widget) {
      settings.set_string(KEY, options[widget.get_active()]);
    }));
    
    this.attachLabel(KEY,pos,box);
    box.attach(SettingCombo, 0, pos+1, 1, 1);
  },

  refreshList: function()  {
    this._store.clear();
    let appsList = settings.get_strv('list');
    let nameList = settings.get_strv('name-list');

    for (let i = 0; i < nameList.length; i++) {
      let appInfo = Gio.DesktopAppInfo.new(appsList[i]);
      if(Gio.DesktopAppInfo.new(appsList[i])==null){
        appsList.splice(i,1);
        nameList.splice(i,1);
        i--;
      }
      else {
        this._store.set(this._store.append(),[0, 2, 1],[appInfo, appInfo.get_icon(), nameList[i]]);
      }
    }
    
    settings.set_strv('list',appsList);
    settings.set_strv('name-list', nameList);
  },

  removeApp: function() {
    let [any, model, iter] = this.treeView.get_selection().get_selected();
    let appsList = settings.get_strv('list');
    let nameList = settings.get_strv('name-list');

    if (any) {
      let indx,appInfo = this._store.get_value(iter, 0); 
      appsList.splice((indx=appsList.indexOf(appInfo.get_id())),1);
      nameList.splice(indx,1);
      settings.set_strv('list',appsList);
      settings.set_strv('name-list', nameList);
      this._store.remove(iter);
    }
  },

  showPrefs: function() {
    let box = new Gtk.Grid({ column_spacing: 20, halign: Gtk.Align.CENTER, margin: 20, row_spacing: 20 });
    this.prefCombo('for-list',1,['none','count','banner','both'], [_('Show them'),_('Show counts only'),_('Show banner only'),_('Ignore them')],box);
    let addButton = new Gtk.Button({label: _("     Add    "), halign:Gtk.Align.START});
    addButton.connect('clicked', Lang.bind(this, this.addApp));
    box.attach(addButton, 0, 0, 1, 1);

    let delButton = new Gtk.Button({label: _(" Remove "), halign:Gtk.Align.END});
    delButton.connect('clicked', Lang.bind(this, this.removeApp));
    box.attach(delButton, 0, 0, 1, 1);
    this.attach(box, 1, 0, 1, 1);
  }
});

const AboutPage = new GObject.Class({
  Name: 'AboutPage',
  Extends: Gtk.ScrolledWindow,

  _init: function(params) {
    this.parent();
    let vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, margin: 30 });
    let imageBox = new Gtk.Box();
    let image = new Gtk.Image({ file: Me.dir.get_child('eicon.png').get_path(), pixel_size: 96 });
    let textBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
    let text = new Gtk.Label({ wrap: true, 
                               justify: 2, 
                               use_markup: true, 
                               label: "<big><b>"+Metadata.name+"</b></big>"+"\n"+"<small>Version "+Metadata.version +"</small>\n\n"+ (Metadata.description)
                                      +"\n\n\n\n\n\n\n\n\n" +"<span size=\"small\">This program comes with ABSOLUTELY NO WARRANTY.\nSee the " 
                                      +"<a href=\"https://www.gnu.org/licenses/old-licenses/gpl-2.0.html\">GNU General Public License, version 2 or later</a>" 
                                      +"for details.</span>" + "\n" 
                             });
    let ResetExtensionButton = new Gtk.Button({label: _("Reset To Default Preferences"),halign:Gtk.Align.CENTER});
    
    imageBox.set_center_widget(image);
    vbox.pack_start(imageBox, false, false, 0);
    textBox.pack_start(text, false, false, 0);
    vbox.pack_start(textBox, false, false, 0);
    vbox.pack_start(ResetExtensionButton,  false, false, 0);
    
    this.add(vbox);
    ResetExtensionButton.connect('clicked', ()=> this.resetExtension());
  },
  
  resetExtension: function() {
		settings.reset("show-media"             );
		settings.reset("show-notifications"     );
		settings.reset("show-events"            );
		settings.reset("show-events-in-calendar");
		settings.reset("dnd-position"           );
		settings.reset("clear-button-alignment" );
		settings.reset("banner-pos"             );
		settings.reset("max-height"             );
		
		settings.reset("indicator-pos"          );
		settings.reset("individual-icons"       );
		settings.reset("autohide"               );
		settings.reset("indicator-shortcut"     );
		settings.reset("new-notification"       );
		settings.reset("include-events-count"   );
		settings.reset("blink-icon"             );
		settings.reset("blink-time"             );
		settings.reset("show-label"             );
		settings.reset("middle-click-dnd"       );
		
		settings.reset("list"                   );
		settings.reset("name-list"              );
		settings.reset("for-list"               );
		
		this.reloadExtension();
	}, 
	
	reloadExtension: function() {
    (settings.get_boolean("reload-signal"))?settings.set_boolean("reload-signal", false):settings.set_boolean("reload-signal", true);
  },
});
