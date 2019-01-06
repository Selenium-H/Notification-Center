
//Customise the poition of Notification banner by Uncommenting the Proper function

const Main = imports.ui.main;

function init() 
{
}

function enable() 
{
        right();       // Puts Notification Baner to Right
        //left()         // Puts Notification nammer to left
}

function disable() 
{
   	center();
}

function left()
{
	Main.messageTray._bannerBin.x=-(Main.layoutManager.monitors[0].width)+(Main.panel.statusArea.dateMenu._messageList.actor.width);	
}

function right()
{
	Main.messageTray._bannerBin.x=(Main.layoutManager.monitors[0].width)-(Main.panel.statusArea.dateMenu._messageList.actor.width);	
}

function center()
{
	Main.messageTray._bannerBin.x=0;	
}

