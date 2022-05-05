import http, { IncomingMessage, ServerResponse } from 'http';

const runStatusServer = () => {
    const listener = (req: IncomingMessage, res: ServerResponse) => {
        res.writeHead(200);
        res.end('Online');
    }
    
    const server = http.createServer(listener);
    server.listen(8080);
}

export default runStatusServer;
