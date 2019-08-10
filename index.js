// Requirements for this to work.
const express = require("express")
const cors = require("cors")
const fetch = require("node-fetch")

// Creates the app.
const app = express()

// Adds CORS to the app.
app.use(cors())

// A list of tokens which are allowed.
const tokens = {}

// Handles the auth in the mock server.
app.get("/uploaders_api/v1/auth/swap/:uploader", async(req, res) => {
    const uploader = req.params.uploader

    const fetchRes = await fetch(`https://api.magiccap.me/swap_tokens/create/${encodeURIComponent(uploader)}`)
    const json = await fetchRes.json()
    if (!fetchRes.ok) {
        res.status(fetchRes.status)
        console.log(`FAIL: ${JSON.stringify(json)}`)
        res.json(json)
        return
    }

    tokens[json.client_token] = json.expires
    console.log(`OK: ${JSON.stringify(json)}`)
    delete json.client_token
    res.json(json)
})

// Middleware to handle swap auth.
const authMiddleware = (req, res, next) => {
    const forbidden = () => {
        res.status(403)
        res.json({
            success: false,
            message: "Forbidden.",
        })
        console.log("Auth middleware fail.")
    }

    const authorization = req.headers.authorization
    if (!authorization) return forbidden()

    const authSplit = authorization.split(/ /)
    if (authSplit.length !== 2) return forbidden()

    const bearer = authSplit[0].toLowerCase()
    if (bearer !== "bearer") return forbidden()

    const token = authSplit[1]
    const row = tokens[token]
    if (!row || Math.floor(Date.now() / 1000) > row) return forbidden()

    req.token = token
    req.uploaderSlug = row.uploader

    next()
    console.log("Auth middleware complete.")
}

// Handles token revokes.
app.get("/uploaders_api/v1/auth/revoke", [authMiddleware], (req, res) => {
    const token = req.token
    delete tokens[token]
    res.json({
        success: true,
    })
    console.log("Token revoked.")
})

// Defines if the uploader is default.
let defaultUploader = true

// Allows for a uploader to check if it is default.
app.get("/uploaders_api/v1/uploaders/default_check", [authMiddleware], (_, res) => {
    res.json({
        success: true,
        default: defaultUploader,
    })
    console.log(`Default check ran. Returned ${defaultUploader}.`)
})

// Toggles the default uploader boolean.
const uploaderPrompt = () => defaultUploader = !defaultUploader

// Allows for a uploader to prompt to be default.
app.get("/uploaders_api/v1/uploaders/default_prompt", [authMiddleware], (_, res) => {
    res.json({
        success: true,
    })

    uploaderPrompt()
    console.log("Prompt ran. Uploader toggled as default.")
})

// Allows for the write-only editing of uploaders.
app.get("/uploaders_api/v1/uploaders/set", [authMiddleware], (req, res) => {
    const config = {}

    const query = req.query
    for (const queryPart of Object.keys(query)) {
        let jsonParse
        try {
            jsonParse = JSON.parse(query[queryPart])
        } catch (_) {
            res.status(400)
            res.json({
                success: false,
                message: "Failed to JSON parse a part of your configuration.",
            })
            return
        }

        config[queryPart] = jsonParse
    }

    res.json({
        success: true,
    })
    console.log(`This would add ${JSON.stringify(config)} to your configuration.`)
})

// Starts the app.
app.listen(61222, () => console.log("Listening on port 61222."))
