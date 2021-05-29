/*

Version 24.00
=============

*/

const Config            = imports.misc.config;
const Extension         = imports.misc.extensionUtils.getCurrentExtension();
const GLib              = imports.gi.GLib;

function init() {
}

function buildPrefsWidget() {

  let gtkVersion = (Config.PACKAGE_VERSION >= "40") ? Extension.imports.prefsGtk4 : Extension.imports.prefsGtk3;
  gtkVersion.init();
  let widget = new gtkVersion.Prefs_NotificationCenterExtension();   
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 0, ()=> {    
    new gtkVersion.ExtensionPreferencesWindow_NotificationCenterExtension( widget );
    return false;
  });
 
  (Config.PACKAGE_VERSION >= "40") ? null : widget.show_all();  
  return widget;  
  
}

