/**
 * Misc types.
 */

type PSRoom = import('./room').PSRoom;
type PSUser = import('./user').PSUser;
type CommandBase = import('./commands').CommandBase;

namespace PS {
    export type PLine = import('./main').PLine;
    export type PLineHandler = import('./main').PLineHandler;
}