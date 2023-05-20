import express, { Application, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import serveStatic from 'serve-static';
import * as url from 'url';
import { Issuer, generators, TokenSet } from 'openid-client';
import { User } from './model';

const code_verifier = generators.codeVerifier();
const code_challenge = generators.codeChallenge(code_verifier);


const SERVER_HOST = process.env.SERVER_HOST || 'localhost'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const app: Application = express()
app.use(express.json())
app.use(cookieParser())

const port: number = 3000

const auth = async (req: Request, res: Response, next: NextFunction) => {
    const token = req?.cookies?.bearer
    if (!token) {
        res.status(401)
            .send('token not provided')
            .end()
    } else {
        const issuer = await Issuer.discover('https://7f000001.nip.io:8443/kc/realms/demo')
        const client = new issuer.Client({
            client_id: 'demo'
        })
        const userinfo = await client.userinfo(token, {
            tokenType: "Bearer"
        })
        console.log(userinfo)
        res.locals.email = userinfo.email;
        res.locals.user = userinfo.name;
        next()
    }
}

app.use(serveStatic(`${__dirname}/static`, { index: ['default.html', 'default.htm'] }))

app.get('/private', auth, (req: Request, res: Response) => {
    res.setHeader('content-type', 'text/html')
        .send(`Welcome back ${res.locals.user}, your email is ${res.locals.email}<br><a href="/logout">Logout</a>`)
})


app.get('/logout', async (req: Request, res: Response) => {
    const token = req?.cookies?.bearer
    const id_token = req?.cookies?.id_token
    if (!token || !id_token) {
        res.redirect('/')
        return
    }
    const issuer = await Issuer.discover('https://7f000001.nip.io:8443/kc/realms/demo')
    const client = new issuer.Client({ client_id: 'demo' })
    res.clearCookie('bearer')
        .clearCookie('id_token')
        .redirect(client.endSessionUrl({
            id_token_hint: id_token,
            post_logout_redirect_uri: 'https://7f000001.nip.io:8443/'
        }))
})

app.get('/login/:idp', async (req: Request, res: Response) => {
    let issuer
    let client
    switch (req.params.idp) {
        case 'keycloak':
            issuer = await Issuer.discover('https://7f000001.nip.io:8443/kc/realms/demo')
            client = new issuer.Client({
                client_id: 'demo',
                client_secret: 'iLHLGwnmpyp2O9MccRKkFaO6Hxe0UoIR'
            }
            )
            break;
        default:
            res.status(400)
                .send('invalid idp')
            return
    }
    res.redirect(client.authorizationUrl({
        redirect_uri: `https://${SERVER_HOST}/callback`,
        response_type: 'code',
        scope: 'openid email profile',
        state: generators.random()
    }))
})

app.get('/callback', async (req: Request, res: Response) => {
    try {
        const code = req?.query?.code
        if (code) {
            const issuer = await Issuer.discover('https://7f000001.nip.io:8443/kc/realms/demo')
            const client = new issuer.Client({
                client_id: 'demo',
                client_secret: 'iLHLGwnmpyp2O9MccRKkFaO6Hxe0UoIR',
                id_token_signed_response_alg: 'ES512'
            })

            const params = client.callbackParams(req);

            const tokenSet = await client.callback(
                `https://${SERVER_HOST}/callback`,
                params,
                { state: params.state },
                {});

            const token = tokenSet.access_token
            const id_token = tokenSet.id_token
            const { email, name } = tokenSet.claims()
            // const [user, created] = await User.findOrCreate({
            //     where: { email: email },
            //     defaults: { name: name }
            // });
            // if (created) {
            //     console.log(`new user ${user.email} created.`)
            // }

            const user = await User.create({
                email: email,
                name: name
            })
            console.log(`new user ${user.email} created.`)
            res.cookie('bearer', token, { httpOnly: true, secure: true })
                .cookie('id_token', id_token, { httpOnly: true, secure: true })
                .redirect('/private')
            console.log('received and validated tokens %j', tokenSet);
        } else {
            res.sendStatus(401)
        }
    }
    catch (e) {
        console.log(e)
        res.sendStatus(503)
    } finally {
        res.end()
    }
});

app.post('/user', async (req: Request, res: Response) => {
    try {
        const { name, age } = req.body
        if (name && age) {
            const user = await User.create({ name: name, age: age })
            const { id, ...output } = user.toJSON()
            res.status(200)
                .json(output)
        } else {
            throw new Error('invalid input')
        }
    } catch (e) {
        switch (e.message) {
            case 'invalid input':
                res.status(401)
                    .send(e.message)
                console.warn(`${JSON.stringify({
                    error: {
                        message: e.message
                    },
                    request: {
                        from: req.ip,
                        method: req.method,
                        path: req.path,
                        payload: req.body
                    }
                })}`)
                break;
            default:
                res.status(503)
                break;
        }
        res.status(503)
    } finally {
        res.end()
    }
});

app.listen(port, () => {
    console.log(`App is listening on port ${port} !`)
});




