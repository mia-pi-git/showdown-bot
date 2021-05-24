**A simple, easily customizable bot for connecting to Pokemon Showdown.**

Simply copy config-example to config.js, set `exports.name` and `exports.pass`, then run `npm start`. 
It will connect to the main PS server, where you can do what you like.

Add files in the `src/plugins` directory to add commands - all commands should be a class extending `PS.CommandBase`. Export the class.