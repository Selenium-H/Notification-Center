
/*
Version 22.01
=============
 
*/

const Config         = imports.misc.config;
const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Gettext        = imports.gettext;
const Gio            = imports.gi.Gio;
const GLib           = imports.gi.GLib;
const GObject        = imports.gi.GObject;
const Gtk            = imports.gi.Gtk;
const Lang           = imports.lang;
const Mainloop       = imports.mainloop;
const Metadata       = Me.metadata;
const _              = Gettext.domain("notification-center").gettext;

let settings = null;

function init() {

  ExtensionUtils.initTranslations("notification-center");
  settings = ExtensionUtils.getSettings("org.gnome.shell.extensions.notification-center");
  
}

function buildPrefsWidget() {

  let widget   = new Prefs_NotificationCenterExtension();
  let switcher = new Gtk.StackSwitcher({halign: Gtk.Align.CENTER, visible: true, stack: widget});
  Mainloop.timeout_add(0, () => {
    widget.get_toplevel().get_titlebar().custom_title = switcher;
    return false;
  });

  widget.show_all();
  return widget;
  
}

function reloadExtension () {

  (settings.get_boolean("reload-signal"))?settings.set_boolean("reload-signal", false):settings.set_boolean("reload-signal", true);
    
}

function reloadApplicationProfiles() {
  
  (settings.get_boolean("reload-profiles-signal")) ? settings.set_boolean("reload-profiles-signal", false) : settings.set_boolean("reload-profiles-signal", true);
    
}

const AboutPage_NotificationCenterExtension = new GObject.Class({
  Name: 'AboutPage_NotificationCenterExtension',
  Extends: Gtk.ScrolledWindow,

  _init: function(params) {
  
    this.parent();
    
  },
  
  showInfo: function() {
  
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
  
    settings.reset("show-media");
    settings.reset("show-notification");
    settings.reset("show-events");
    settings.reset("beside-calendar");
    settings.reset("calendar-on-left");
    settings.reset("hide-events-section-if-empty");
    settings.reset("dnd-position");
    settings.reset("clear-button-alignment");
    settings.reset("autoclose-menu");
    settings.reset("indicator-shortcut");
    settings.reset("max-height");
    settings.reset("banner-pos");
    settings.reset("sections-order");
    settings.reset("hide-clock-section");
    settings.reset("hide-weather-section");
    settings.reset("hide-date-section");

    settings.reset("indicator-pos");
    settings.reset("indicator-index");
    settings.reset("individual-icons");
    settings.reset("autohide");
    settings.reset("new-notification");
    settings.reset("change-icons");
    settings.reset("include-events-count");
    settings.reset("blink-icon");
    settings.reset("blink-time");
    settings.reset("animate-icon");    
    settings.reset("show-label");
    settings.reset("middle-click-dnd");
		
    settings.reset("list");
    settings.reset("name-list");
    settings.reset("for-list");
		
    reloadExtension();
		
  }, 
	
});

const Prefs_NotificationCenterExtension = new GObject.Class({
  Name: 'Prefs_NotificationCenterExtension',
  Extends: Gtk.Stack,
    
  _init: function() {
  
    this.notificationPrefs = new PrefsWindowForNotifications_NotificationCenterExtension();
    this.indicatorPrefs    = new PrefsWindowForIndicator_NotificationCenterExtension();
    this.appListPrefs      = new PrefsWindowForAppList_NotificationCenterExtension();
    this.aboutPage         = new AboutPage_NotificationCenterExtension();
    
    this.notificationPrefsWindow = new Gtk.ScrolledWindow({hexpand: true,shadow_type: Gtk.ShadowType.IN});
    this.notificationPrefsWindow.add(this.notificationPrefs);
    
    this.parent({ transition_type: 6, transition_duration: 200 });
    this.add_titled(this.notificationPrefsWindow, "Notifications", _("Notifications"));
    this.add_titled(this.indicatorPrefs,          "Indicator",     _("Indicator")    );
    this.add_titled(this.appListPrefs,            "List",          _("List")         );
    this.add_titled(this.aboutPage,               "About",         _("About")        );
    
    this.notificationPrefs.displayPrefs();
    this.indicatorPrefs.displayPrefs();
    this.appListPrefs.displayPrefs();
    this.aboutPage.showInfo();

  }
  
});

const PrefsWindow_NotificationCenterExtension =  new GObject.Class({
  Name: "PrefsWindow_NotificationCenterExtension",
  Extends: Gtk.Grid,

  _init: function(page) {
    
    this.parent({ column_spacing: 80, halign: Gtk.Align.CENTER, margin: 20, row_spacing: 20 ,border_width:20});

  },

  attachLabel: function(KEY,pos) {
    let prefLabel = new Gtk.Label({xalign: 1, label: _(settings.settings_schema.get_key(KEY).get_summary()), halign: Gtk.Align.START});
    this.attach(prefLabel,0,pos,1,1);
  },
   
  prefCombo: function(KEY, pos, options, items) {
  
    let SettingCombo = new Gtk.ComboBoxText();
    for (let i = 0; i < options.length; i++) {
      SettingCombo.append(options[i],  items[i]);
    }
    SettingCombo.set_active(options.indexOf(settings.get_string(KEY)));
    SettingCombo.connect('changed', Lang.bind(this, function(widget) {
      settings.set_string(KEY, options[widget.get_active()]);
      reloadExtension();
    }));
    
    this.attachLabel(KEY,pos);
    this.attach(SettingCombo, 1, pos, 1, 1);
    
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
    this.attach(box    ,1, pos, 1,  1);
    
  },
  
  prefSwitch: function(KEY, pos) {
  
    let SettingSwitch = new Gtk.Switch({hexpand: false, active: settings.get_boolean(KEY), halign: Gtk.Align.END});
    SettingSwitch.connect("notify::active", Lang.bind(this, function(button) {
      settings.set_boolean(KEY, button.active);
      reloadExtension();
    }));
    this.attachLabel(KEY,pos);
    this.attach(SettingSwitch, 1, pos, 1, 1);
    
  },

  prefTime: function(KEY, pos, mn, mx, st) {
  
    let timeSetting = Gtk.SpinButton.new_with_range(mn, mx, st);
    timeSetting.set_value(settings.get_int(KEY));
    timeSetting.connect('notify::value', function(spin) {
      settings.set_int(KEY,spin.get_value_as_int());
    });

    this.attachLabel(KEY,pos);
    this.attach(timeSetting, 1, pos, 1, 1);
    
  },

});


const PrefsWindowForAppList_NotificationCenterExtension = new GObject.Class({
  Name: 'PrefsWindowForAppList_NotificationCenterExtension',
  Extends: Gtk.Grid,

  _init: function() {
  
    this.parent();

  },


  attachLabel: function(KEY,pos,box) {
    let prefLabel = new Gtk.Label({xalign: 1, label: _(settings.settings_schema.get_key(KEY).get_summary()), halign: Gtk.Align.START});
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
      reloadApplicationProfiles();

      dialog.destroy();
    }));
    
    dialog.show_all();
  },

  displayPrefs: function() {
  
    this.makeList();
    this.showPrefs();
    this.refreshList();
  
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
    appColumn.set_fixed_width(370);
    listBox.add(this.treeView);
    this.attach(listBox,0,0,1,1);
    
  },

  prefCombo: function(KEY, pos, options, items, box) {
  
    let SettingCombo = new Gtk.ComboBoxText();
    for (let i = 0; i < options.length; i++) {
      SettingCombo.append(options[i],  items[i]);
    }
    SettingCombo.set_active(options.indexOf(settings.get_string(KEY)));
    SettingCombo.connect('changed', Lang.bind(this, function(widget) {
      settings.set_string(KEY, options[widget.get_active()]);
      reloadApplicationProfiles();
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

    reloadApplicationProfiles();
    
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

const PrefsWindowForIndicator_NotificationCenterExtension =  new GObject.Class({
  Name: "PrefsWindowForIndicator_NotificationCenterExtension",
  Extends: PrefsWindow_NotificationCenterExtension,
  
  _init: function(){
  
    this.parent();
  
  },
  
  displayPrefs: function(){
  
    let pos = 0;
    
    this.prefCombo   ("indicator-pos",           pos++, ['left','center','right'],                 [_('Left'), _('Center'), _('Right')]                            );
    this.prefInt     ("indicator-index",         pos++,    0,   20,       1                                                                                        );
    this.prefSwitch  ("individual-icons",        pos++                                                                                                             );
    this.prefSwitch  ("change-icons",            pos++                                                                                                             );
    this.prefComboInt("autohide",                pos++, ['0','1','2'],                             [_("No"),_("Yes"),_("If Do Not Disturb is Off")]                );
    this.prefCombo   ("new-notification",        pos++, ['none', 'dot', 'count'],                  [_('Show Nothing'), _('Show Dot'), _('Show Count')]             );
    this.prefSwitch  ("include-events-count",    pos++                                                                                                             );
    this.prefTime    ("blink-icon",              pos++,    0,     10000,       1                                                                                   );
    this.prefTime    ("blink-time",              pos++,    100,   10000,       10                                                                                  );
    this.prefSwitch  ("animate-icon",            pos++                                                                                                             );
    this.prefSwitch  ("show-label",              pos++                                                                                                             );
    this.prefSwitch  ("middle-click-dnd",        pos++                                                                                                             );

  },

  prefComboInt: function(KEY, pos, options, items) {
  
    let SettingCombo = new Gtk.ComboBoxText();
    for (let i = 0; i < options.length; i++) {
      SettingCombo.append(options[i],  items[i]);
    }
    SettingCombo.set_active(settings.get_int(KEY));
    SettingCombo.connect('changed', Lang.bind(this, function(widget) {
      settings.set_int(KEY, widget.get_active());
      reloadExtension();
    }));
    
    this.attachLabel(KEY,pos);
    this.attach(SettingCombo, 1, pos, 1, 1);
    
  },
  
  prefInt: function(KEY,pos) {
  
    let timeSetting = Gtk.SpinButton.new_with_range(0, 20, 1);
    timeSetting.set_value(settings.get_int(KEY));
    timeSetting.connect('notify::value', function(spin) {
      settings.set_int(KEY,spin.get_value_as_int());
      reloadExtension();
    });

    this.attachLabel(KEY,pos);
    this.attach(timeSetting, 1, pos, 1, 1);
    
  },

});

const PrefsWindowForNotifications_NotificationCenterExtension =  new GObject.Class({
  Name: "PrefsWindowForNotifications_NotificationCenterExtension",
  Extends: PrefsWindow_NotificationCenterExtension,
  
  _init: function(){
  
    this.parent();
    this.orderSectionsReOrderRunning = false;
  
  },

  adjustOtherSectionsKeepingThisKeyValueSame: function(KEY) {
  
    let currentKeyValue = settings.get_int(KEY);
    let currentSection = KEY.substring(5,KEY.length); 
    
    if(currentKeyValue == 0) {
      return;
    }
  
    let mediaNotificationEventsSectionOrder = [ settings.get_int("show-media"), settings.get_int("show-notification"), settings.get_int("show-events") ];
    
    let missingValue=1;
    
    for(missingValue=1;missingValue<=3;missingValue++){
      if(mediaNotificationEventsSectionOrder.indexOf(missingValue)==-1){
        break;
      }
    }
    
    if(currentKeyValue == mediaNotificationEventsSectionOrder[0] && currentSection!="media"){
      settings.set_int("show-media",missingValue);
    }
    
    if(currentKeyValue == mediaNotificationEventsSectionOrder[1] && currentSection!="notification"){
      settings.set_int("show-notification",missingValue);
    }
    
    if(currentKeyValue == mediaNotificationEventsSectionOrder[2] && currentSection!="events"){
      settings.set_int("show-events",missingValue);
    }
  
  },
  
  displayPrefs: function() {
  
    let pos = 0;
  
    this.prefSectionPosition ("show-media",         pos++, ["none","top","middle","bottom"], [_("Don't Show"), _('At The Top'),_('In The Middle'), _('At The Bottom')]);
    this.prefSectionPosition ("show-notification",  pos++, ["none","top","middle","bottom"], [_("Don't Show"), _('At The Top'),_('In The Middle'), _('At The Bottom')]);
    this.prefSectionPosition ("show-events",        pos++, ["none","top","middle","bottom"], [_("Don't Show"), _('At The Top'),_('In The Middle'), _('At The Bottom')]);
    this.prefCombo ("beside-calendar",              pos++, ["events","show","hide"],         [_("Show Events"), _("Show Remaining Sections"), _("Hide If Empty")]     );
    this.prefSwitch("calendar-on-left",             pos++                                                                                                             );
    this.prefSwitch("hide-events-section-if-empty", pos++                                                                                                             );
    this.prefCombo ("dnd-position",                 pos++, ["none","top","bottom"],          [_("Don't Show"), _('On Top'), _('At Bottom')]                           );
    this.prefCombo ("clear-button-alignment",       pos++, ['left','center','right','hide'], [_('Left'), _('Center'), _('Right'), _("Don't Show")]                    );
    this.prefSwitch("autoclose-menu",               pos++                                                                                                             );
    this.prefStr   ("indicator-shortcut",           pos++, ['<Alt>', '<Ctrl>', '<Shift>', '<Super>'], [_('Alt Key'), _('Ctrl Key'), _('Shift Key'), _('Super Key')]   );
    this.prefTime  ("max-height",                   pos++, 20,  100, 1                                                                                                );
    this.prefSwitch("hide-clock-section",           pos++                                                                                                             );
    this.prefSwitch("hide-weather-section",         pos++                                                                                                             );
    this.prefSwitch("hide-date-section",            pos++                                                                                                             );
    this.prefCombo ("banner-pos",                   pos++, ['left','center','right' ],       [_('Left'), _('Center'), _('Right')]                                     );  
    
  },
  
  prefSectionPosition: function(KEY, pos, options, items) {
  
    let SettingCombo = new Gtk.ComboBoxText();
    for (let i = 0; i < options.length; i++) {
      SettingCombo.append(options[i],  items[i]);
    }
    SettingCombo.set_active(settings.get_int(KEY));
    SettingCombo.connect('changed', Lang.bind(this, function(widget) {
      
      settings.set_int(KEY,widget.get_active());
      this.adjustOtherSectionsKeepingThisKeyValueSame(KEY);
      this.reorderOrderOfSections();
      reloadExtension();
    }));
    
    settings.connect("changed::"+KEY,()=>{SettingCombo.set_active(settings.get_int(KEY));})
    
    this.attachLabel(KEY,pos);
    this.attach(SettingCombo, 1, pos, 1, 1);

  },
 
  reorderOrderOfSections: function() {
  
    let orderStr = ["noValue","noValue","noValue"];
    
    let mediaNotificationEventsSectionOrder = [ settings.get_int("show-media"), settings.get_int("show-notification"), settings.get_int("show-events") ];
    
    if(mediaNotificationEventsSectionOrder[0]!=0){
      orderStr[mediaNotificationEventsSectionOrder[0]-1] = "media";
    }
    
    if(mediaNotificationEventsSectionOrder[1]!=0){
      orderStr[mediaNotificationEventsSectionOrder[1]-1] = "notification";
    }
    
    if(mediaNotificationEventsSectionOrder[2]!=0){
      orderStr[mediaNotificationEventsSectionOrder[2]-1] = "events";
    }
    
    let tempOrderStr=[];
    
    for(let i=0;i<3;i++) {
      if(orderStr[i]!="noValue"){
        tempOrderStr.push(orderStr[i]);
      }
    }
   
    settings.set_strv("sections-order",tempOrderStr);
     
  },
  
});
