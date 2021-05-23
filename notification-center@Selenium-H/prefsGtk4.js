
/*
Version 23.03
=============
 
*/

const Config         = imports.misc.config;
const ExtensionUtils = imports.misc.extensionUtils;
const Extension      = ExtensionUtils.getCurrentExtension();
const Me             = ExtensionUtils.getCurrentExtension();
const Metadata       = Extension.metadata;
const Gio            = imports.gi.Gio;
const GLib           = imports.gi.GLib;
const GObject        = imports.gi.GObject;
const Gtk            = imports.gi.Gtk;
const Lang           = imports.lang;
const _              = imports.gettext.domain("notification-center").gettext;

let settings = null;

function init() {

  ExtensionUtils.initTranslations("notification-center");
  settings = ExtensionUtils.getSettings("org.gnome.shell.extensions.notification-center");
  
}

function reloadExtension () {

  (settings.get_boolean("reload-signal"))?settings.set_boolean("reload-signal", false):settings.set_boolean("reload-signal", true);
    
}

function reloadApplicationProfiles() {
  
  (settings.get_boolean("reload-profiles-signal")) ? settings.set_boolean("reload-profiles-signal", false) : settings.set_boolean("reload-profiles-signal", true);
    
}


const ExtensionPreferencesWindow_NotificationCenterExtension = new GObject.Class({

  Name: 'ExtensionPreferencesWindow_NotificationCenterExtension',

  _init: function( widget ) {
  
    this.toplevel  = widget.get_native();
    this.headerBar = this.toplevel.get_titlebar();
    this.headerBar.set_title_widget(new Gtk.StackSwitcher({halign: Gtk.Align.CENTER, stack: widget}));
    this.createAppMenu();  
    this.createRefreshButton();  
    
  },
  
  createAppMenu: function( ) {
      
    let preferencesDialogAction = new Gio.SimpleAction({ name: 'preferences'});  
    let helpDialogAction        = new Gio.SimpleAction({ name: 'help'});
    let aboutDialogAction       = new Gio.SimpleAction({ name: 'about'});
    let actionGroup             = new Gio.SimpleActionGroup();
    let menu                    = new Gio.Menu();
    let appMenu                 = Gtk.PopoverMenu.new_from_model(menu);
    let appMenuButton           = new Gtk.MenuButton({ popover: appMenu, icon_name: "open-menu-symbolic", visible:true});

    menu.append(_("Preferences"),               "prefswindow.preferences");
    menu.append(_("Help"),                      "prefswindow.help"       );
    menu.append(_("About")+" Notification Center", "prefswindow.about"      );
    
    actionGroup.add_action(aboutDialogAction);
    actionGroup.add_action(helpDialogAction);
    actionGroup.add_action(preferencesDialogAction);
    
    this.toplevel.insert_action_group('prefswindow', actionGroup);    
    this.headerBar.pack_end(appMenuButton);
    
    preferencesDialogAction.connect('activate', ()=> {
      let dialog = new Gtk.Dialog({ title: _("Preferences"),transient_for: this.toplevel,use_header_bar: true, modal: true });
      let vbox                  = new Gtk.Box({ hexpand:true, vexpand: true, valign:Gtk.Align.CENTER, orientation: Gtk.Orientation.VERTICAL });    
      this.resetExtensionButton = new ExtensionResetButton_NotificationCenterExtension(this.toplevel );
      vbox.append(this.resetExtensionButton);
      dialog.get_content_area().append(vbox);  
      dialog.present();  
    });

    helpDialogAction.connect('activate', ()=> {
      let dialog    = new Gtk.Dialog({ title: _("Help"), transient_for: this.toplevel, use_header_bar: true, modal: true });
      let vbox      = new Gtk.Box({ hexpand:true, vexpand: true, valign:Gtk.Align.CENTER, orientation: Gtk.Orientation.VERTICAL });    
      let firstInfo = new Gtk.Label({ justify: 0, use_markup: true, label: _(Metadata.description)});  
      vbox.append(firstInfo);
      dialog.get_content_area().append(vbox);  
      dialog.present();  
    });    

    aboutDialogAction.connect('activate', ()=> {  
      let aboutDialog = new Gtk.AboutDialog({ transient_for: this.toplevel, modal: true, logo: (new Gtk.Image({ file: Extension.dir.get_child('eicon.png').get_path(), pixel_size: 128 })).get_paintable(), program_name: Extension.metadata.name, version: Extension.metadata.version.toString()+_(Extension.metadata.status), comments: _(Extension.metadata.comment), license_type: 3 } );
      aboutDialog.get_titlebar().get_title_widget().visible = true;
      aboutDialog.present();      
    });
    
  },
  
  createRefreshButton: function() {
  
    let refreshButton = new Gtk.Button({ icon_name: "view-refresh-symbolic", visible:true}); 
    refreshButton.connect('clicked', ()=> {
      reloadExtension();
    });
    this.headerBar.pack_start(refreshButton);

  },  
  
});

const ExtensionResetButton_NotificationCenterExtension =  new GObject.Class({

  Name: 'ExtensionResetButton_NotificationCenterExtension',

  _init: function( object ) {
    
    this.resetExtensionButton = new Gtk.Button({label: _("Reset Notification Center Extension"),halign:Gtk.Align.CENTER});
    this.resetExtensionButton.connect('clicked', ()=> { this.resetExtension( object, null, null ) });    
    return this.resetExtensionButton;
    
  },
  
  resetExtension: function( object, functionToBeCalledAtTheEnd, parameter ) {
  
    let dialog = new Gtk.MessageDialog({ transient_for: object.get_native ? object.get_native() : object, modal: true });  
    dialog.set_default_response(Gtk.ResponseType.OK);
    dialog.add_button("Cancel", Gtk.ResponseType.CANCEL);
    dialog.add_button("OK", Gtk.ResponseType.OK);
    dialog.set_markup("<big><b>"+_("Reset Animation Tweaks to defaults?")+"</b></big>");
    dialog.get_message_area().append(new Gtk.Label({ wrap: true, justify: 3, use_markup: true, label: _("Resetting the extension will discard the current preferences configuration and restore default one.")}));
    dialog.connect('response', Lang.bind(this, function(dialog, id) {
      if(id != Gtk.ResponseType.OK) {
        dialog.destroy();  
        return;
      }
  
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
		
    settings.reset("application-list");
    settings.reset("name-list");
    settings.reset("script-list");
    settings.reset("for-list");

    //settings.set_int("current-version", Metadata.version);
    dialog.destroy();
    if(object[functionToBeCalledAtTheEnd]) {
      object[functionToBeCalledAtTheEnd]( parameter );
    }
		
    reloadExtension();
    }));
    
    dialog.show_all();
		
  }, 
	  
});

const Prefs_NotificationCenterExtension = new GObject.Class({
  Name: 'Prefs_NotificationCenterExtension',
  Extends: Gtk.Stack,
    
  _init: function() {
  
    this.notificationPrefs = new PrefsWindowForNotifications_NotificationCenterExtension();
    this.indicatorPrefs    = new PrefsWindowForIndicator_NotificationCenterExtension();
    this.appListPrefs      = new PrefsWindowForAppList_NotificationCenterExtension();
    
    this.notificationPrefsWindow = new Gtk.ScrolledWindow({hexpand: true});
    this.notificationPrefsWindow.set_child(this.notificationPrefs);
    
    this.parent({ transition_type: 6, transition_duration: 200 });
    this.add_titled(this.notificationPrefsWindow, "Notifications", _("Notifications"));
    this.add_titled(this.indicatorPrefs,          "Indicator",     _("Indicator")    );
    this.add_titled(this.appListPrefs,            "Profiles",      _("Profiles")     );
    
    this.notificationPrefs.displayPrefs();
    this.indicatorPrefs.displayPrefs();
    this.appListPrefs.displayPrefs();

  }
  
});

const PrefsWindow_NotificationCenterExtension =  new GObject.Class({
  Name: "PrefsWindow_NotificationCenterExtension",
  Extends: Gtk.Grid,

  _init: function(page) {
    
    this.parent({ column_spacing: 80, halign: Gtk.Align.CENTER,  margin_top: 20, margin_end: 20, margin_bottom: 20, margin_start: 20, row_spacing: 20 });

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
    
    box.append(SettingCombo);
    box.append(new Gtk.Label({label: "  +  "}));
    box.append(strSetting);
    
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

  appViewChange: function() {
    let applicationList = settings.get_strv("application-list");
    let [any, model, iter] = this.treeView.get_selection().get_selected();
    if(any) {
      let appInfo = this._store.get_value(iter, 0); 
      this.selectedIndex=applicationList.indexOf(appInfo.get_id());
    }
    if(this.selectedIndex >= 0 ) {
      let scriptList = settings.get_strv('script-list');
      this.scriptLocation.text = scriptList[this.selectedIndex];
    }
    else {
      this.scriptLocation.text = "";
    }
  
  },

  attachLabel: function(KEY,pos,box) {
    let prefLabel = new Gtk.Label({xalign: 1, label: _(settings.settings_schema.get_key(KEY).get_summary()), halign: Gtk.Align.START});
    box.attach(prefLabel,0,pos,1,1);
  },
 
  addApp: function()  {
    let dialog = new Gtk.Dialog({ title: _('Choose an application'),transient_for: this.get_native(),use_header_bar: true,modal: true });
    dialog._appChooser = new Gtk.AppChooserWidget({  margin_top: 5, margin_end: 5, margin_bottom: 5, margin_start: 5, show_all: true, vexpand: true });
    dialog.set_default_response(Gtk.ResponseType.OK);
    dialog.add_button("Cancel", Gtk.ResponseType.CANCEL);
    let addButton = dialog.add_button("Add", Gtk.ResponseType.OK);
    let hbox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, hexpand:true, vexpand:true});
    hbox.append(dialog._appChooser);
    dialog.get_content_area().append(hbox);
    dialog.connect('response', Lang.bind(this, function(dialog, id) {
      if (id != Gtk.ResponseType.OK) {
              dialog.destroy();
              return;
      }

      let appInfo = dialog._appChooser.get_app_info();
      if (!appInfo) {
        return;
      }

      let applicationList = settings.get_strv('application-list');
      let nameList = settings.get_strv('name-list');
      let scriptList = settings.get_strv('script-list');
      if (applicationList.indexOf(appInfo.get_id())>=0) {
        dialog.destroy();
        return;
      }
      applicationList.push(appInfo.get_id());
      nameList.push(appInfo.get_name());
      scriptList.push("");
      settings.set_strv('application-list', applicationList);
      settings.set_strv('name-list', nameList);
      settings.set_strv('script-list', scriptList);
      this._store.set(this._store.append(),[0, 2, 1],[appInfo, appInfo.get_icon(), appInfo.get_name()]);
      reloadApplicationProfiles();

      dialog.destroy();
    }));
    
    dialog.present();
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
    let listBox   = new Gtk.ScrolledWindow({hexpand: true});
    
    appColumn.pack_start(iconRenderer, false);
    appColumn.pack_start(nameRenderer, true);
    appColumn.add_attribute(iconRenderer, "gicon"  ,2);
    appColumn.add_attribute(nameRenderer, "text"   ,1);
    
    this.treeView.append_column(appColumn);
    appColumn.set_fixed_width(370);
    listBox.set_child(this.treeView);
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
    box.attach(SettingCombo, 1, pos, 1, 1);
    
  },
  
  prefSwitch: function(KEY, pos, box) {
  
    let SettingSwitch = new Gtk.Switch({hexpand: false, active: settings.get_boolean(KEY), halign: Gtk.Align.END});
    SettingSwitch.connect("notify::active", Lang.bind(this, function(button) {
      settings.set_boolean(KEY, button.active);
      reloadExtension();
    }));
    this.attachLabel(KEY,pos, box);
    box.attach(SettingSwitch, 1, pos, 1, 1);
    
  },  

  refreshList: function()  {
  
    this._store.clear();
    let applicationList = settings.get_strv('application-list');
    let nameList = settings.get_strv('name-list');
    let scriptList = settings.get_strv('script-list');

    for (let i = 0; i < applicationList.length; i++) {
      let appInfo = Gio.DesktopAppInfo.new(applicationList[i]);
      if(Gio.DesktopAppInfo.new(applicationList[i])==null){
        applicationList.splice(i,1);
        nameList.splice(i,1);
        scriptList.splice(i,1);
        i--;
      }
      else {
        this._store.set(this._store.append(),[0, 2, 1],[appInfo, appInfo.get_icon(), nameList[i]]);
      }
    }
    
    settings.set_strv('application-list',applicationList);
    settings.set_strv('name-list', nameList);
    settings.set_strv('script-list', scriptList);
    
  },

  removeApp: function() {
  
    let [any, model, iter] = this.treeView.get_selection().get_selected();
    let applicationList = settings.get_strv('application-list');
    let nameList = settings.get_strv('name-list');
    let scriptList = settings.get_strv('script-list');

    if (any) {
      let indx,appInfo = this._store.get_value(iter, 0); 
      applicationList.splice((indx=applicationList.indexOf(appInfo.get_id())),1);
      nameList.splice(indx,1);
      scriptList.splice(indx,1);
      this.selectedIndex= -1;
      settings.set_strv('application-list',applicationList);
      settings.set_strv('name-list', nameList);
      settings.set_strv('script-list', scriptList);
      this._store.remove(iter);
    }

    reloadApplicationProfiles();
    
  },

  showPrefs: function() {
  
    let box = new Gtk.Grid({ column_spacing: 20, halign: Gtk.Align.CENTER, margin_top: 20, margin_bottom: 20, margin_start: 20, margin_end: 20, row_spacing: 20 });
    let addButton = new Gtk.Button({label: _("     Add    "), halign:Gtk.Align.START});
    let delButton = new Gtk.Button({label: _(" Remove "), halign:Gtk.Align.END});
    this.scriptLocation = new Gtk.Entry({text: "" });
    let setButton = new Gtk.Button({label: _("Set"), halign:Gtk.Align.END});
    this.selectedIndex = -1;
    addButton.connect('clicked', Lang.bind(this, this.addApp));
    delButton.connect('clicked', Lang.bind(this, this.removeApp));
    setButton.connect('clicked', ()=> {
      if(this.selectedIndex > -1) {
        let scriptList = settings.get_strv('script-list');
        scriptList[this.selectedIndex] = this.scriptLocation.text;
        settings.set_strv('script-list', scriptList);
      }
    });
    
    box.attach(addButton,                                                                                                                        0, 0,  1, 1);
    box.attach(delButton,                                                                                                                        1, 0,  1, 1);
    box.attach(new Gtk.Label({label: ""}),                                                                                                       0, 1,  2, 1);
    box.attach(new Gtk.Label({use_markup: true, label: "<big><b>"+_("For All Applications on the List")+"</b></big>", halign: Gtk.Align.CENTER}),0, 2,  2, 1);
    box.attach(new Gtk.Label({label: ""}),                                                                                                       0, 3,  2, 1);
    this.prefCombo('for-list',4,['none','count','banner','both'], [_('Show them'),_('Show counts only'),_('Show banner only'),_('Ignore them')],box);
    this.prefSwitch("run-script", 5, box);
    box.attach(new Gtk.Label({label: ""}),                                                                                                       0, 6,  2, 1);
    box.attach(new Gtk.Label({use_markup: true, label: "<big><b>"+_("For Selected Application")+"</b></big>", halign: Gtk.Align.CENTER}),        0, 7,  2, 1);
    box.attach(new Gtk.Label({label: ""}),                                                                                                       0, 8,  2, 1);
    box.attach(new Gtk.Label({label: _("Custom script location "),halign: Gtk.Align.START}),                                                     0, 9,  1, 1);
    box.attach(this.scriptLocation,                                                                                                              0, 10, 2, 1);
    box.attach(setButton,                                                                                                                        1, 11, 1, 1);
    this.attach(box, 1, 0, 1, 1);
    this.treeView.connect("cursor-changed",()=>this.appViewChange());
    
  },
    
});

const PrefsWindowForIndicator_NotificationCenterExtension =  new GObject.Class({
  Name: "PrefsWindowForIndicator_NotificationCenterExtension",
  Extends: PrefsWindow_NotificationCenterExtension,
  
  _init: function(){
  
    this.parent();
  
  },
  
  displayPrefs: function(){
  
    let pos = 0;
    
    this.prefCombo   ("indicator-pos",           pos++, ['left','center','right'],                 [_('Left'), _('Center'), _('Right')]                );
    this.prefInt     ("indicator-index",         pos++,    0,   20,       1                                                                            );
    this.prefSwitch  ("individual-icons",        pos++                                                                                                 );
    this.prefSwitch  ("change-icons",            pos++                                                                                                 );
    this.prefComboInt("autohide",                pos++, ['0','1','2'],                             [_("No"),_("Yes"),_("If Do Not Disturb is Off")]    );
    this.prefCombo   ("new-notification",        pos++, ['none', 'dot', 'count'],                  [_('Show Nothing'), _('Show Dot'), _('Show Count')] );
    this.prefSwitch  ("include-events-count",    pos++                                                                                                 );
    this.prefTime    ("blink-icon",              pos++,    0,     10000,       1                                                                       );
    this.prefTime    ("blink-time",              pos++,    100,   10000,       10                                                                      );
    this.prefSwitch  ("animate-icon",            pos++                                                                                                 );
    this.prefSwitch  ("show-label",              pos++                                                                                                 );
    this.prefSwitch  ("middle-click-dnd",        pos++                                                                                                 );

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
    this.prefCombo ("banner-pos",                   pos++, ["11","12","13","21","22","23","31","32","33"], [_('Top Left'), _('Top Center'), _('Top Right'), _('Middle Left'), _('Middle Center'), _('Middle Right'), _('Bottom Left'), _('Bottom Center'), _('Bottom Right')]);  
    
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
