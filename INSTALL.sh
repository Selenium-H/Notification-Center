#!/bin/bash

echo "Removing any Older Version"
rm -rf ~/.local/share/gnome-shell/extensions/notification-center@Selenium-H
echo "Done"

echo "Copying New Version"
cp -rf notification-center@Selenium-H ~/.local/share/gnome-shell/extensions/
echo "Done"

cd ~/.local/share/gnome-shell/extensions/notification-center@Selenium-H
echo "Compiling Schemas"
glib-compile-schemas schemas
echo "Done"

cd locale

echo "Creating Translations"

mkdir it/LC_MESSAGES
msgfmt it/notification-center.po -o it/LC_MESSAGES/notification-center.mo

echo "All Done !"

