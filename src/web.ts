import express from 'express';

export const WebServer = new class {
    server = express();
    setup() {
        if (!Config.webserver) return;
        for (const [k, handler] of Object.entries(PS.pages)) {
            this.server.get(`/${k}`, async (req, res) => {
                if (this.checkRatebanned(req)) {
                    return res.end(this.ratebanResponse);
                }
                const obj: PS.PageBase = new (handler as any)(req, res);
                const content = await obj.serve();
                res.end(content);
            });
        }
    }
    /** Map<ip, time it was ratebanned at> */
    ratebans = new Map<string, number>();
    requests = new Map<string, number>();
    readonly ratebanResponse = JSON.stringify({error: `Please wait a while before making another request`});
    checkRatebanned(request: express.Request) {
        const rateban = this.ratebans.get(request.ip);
        if (rateban) {
            if (Date.now() - rateban > (Config.ratebanlength || 30 * 60 * 1000)) {
                this.ratebans.delete(request.ip);
            } else {
                return true;
            }
        }
        let num = this.requests.get(request.ip);
        if (!num) {
            num = 0;
            this.requests.set(request.ip, num);
        }
        num++;
        if (num > (Config.ratelimit || 60)) {
            this.rateban(request.ip);
            return true;
        }
        this.requests.set(request.ip, num);
        return false;
    }
    rateban(ip: string) {
        this.ratebans.set(ip, Date.now());
    }
}

WebServer.setup();