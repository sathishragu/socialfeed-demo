let multiparty = require('multiparty')
let then = require('express-then')
let Facebook = require('facebook-node-sdk')
let DataUri = require('datauri')
let nodeify = require('bluebird-nodeify')

let User = require('./models/user')
let Twitter = require('twitter')
//let Comment = require('./models/comment')
let isLoggedIn = require('./middlewares/isLoggedIn')
let request = require('request')
let nodeifyit = require('nodeifyit')
let Promise = require("bluebird")
Promise.promisifyAll(Facebook)
require('songbird')


module.exports = (app) => {
  let passport = app.passport
  let twitterConfig = app.config.auth.twitterAuth
  let facebookconfig = app.config.auth.facebookAuth
    let networks = {
        twitter: {
              icon: 'twitter',
              name: 'twitter',
              class: 'btn-primary'
        },
        facebook: {
              icon: 'facebook',
              name: 'facebook',
              class: 'btn-info'
        },
        google: {
              icon: 'google-plus',
              name: 'google',
              class: 'btn-danger'
        }
    }

    let twitterscope = 'email'

  app.get('/', (req, res) => {
    res.render('index.ejs')
  })

  app.get('/login', (req, res) => {
    res.render('login.ejs', {message: req.flash('error')})
  })

  app.get('/signup', (req, res) => {
    res.render('signup.ejs', {message: req.flash('error')})
  })

  app.post('/login', passport.authenticate('local-signin', {
    successRedirect: '/profile',
    failureRedirect: '/login',
    failureFlash: true
  }))
  // process the signup form
  app.post('/signup', passport.authenticate('local-signup', {
    successRedirect: '/profile',
    failureRedirect: '/signup',
    failureFlash: true
  }))

  app.get('/profile', isLoggedIn, then(async (req, res) => {  
    res.render('profile.ejs', {
      user: req.user,
      message: req.flash('error')
    })
  }))

  app.get('/logout', (req, res) => {
    req.logout()
    res.redirect('/')
  })

  // Facebook - Authentication route and callback URL
    let facebookScope = ['email, publish_actions, user_posts, user_likes, read_stream']
	app.get('/auth/facebook', passport.authenticate('facebook', {scope: facebookScope}))

    app.get('/auth/facebook/callback', passport.authenticate('facebook', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    // Authorization route and callback
    app.get('/connect/facebook', passport.authorize('facebook', {scope: facebookScope}))
    app.get('/connect/facebook/callback', passport.authorize('facebook', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    // Twitter - Authentication route and callback URL
    app.get('/auth/twitter', passport.authenticate('twitter', {scope: twitterscope}))

    app.get('/auth/twitter/callback', passport.authenticate('twitter', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    // Authorization route and callback
    app.get('/connect/twitter', passport.authorize('twitter', {scope: twitterscope}))
    app.get('/connect/twitter/callback', passport.authorize('twitter', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    //Google auth

    let googleScope = 'https://www.googleapis.com/auth/plus.login email'
    app.get('/auth/google', passport.authenticate('google', {scope: googleScope}))
    app.get('/auth/google/callback', passport.authenticate('google', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    //Google Authorize
    app.get('/connect/google', passport.authorize('google', {scope: googleScope}))
    app.get('/connect/google/callback', passport.authorize('google', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    function getFacebookFeeds(req, res, next){
        console.log('inside fb feeds...')
        nodeify(async ()=> {
            console.log('req.user.facebook.token: ' +req.user.facebook.token)
            let url = 'https://graph.facebook.com/v2.2/me/feed?fields=id,from,likes,message&access_token=' + req.user.facebook.token
            await request.promise(url,
                nodeifyit(async (error, response, body) => {
                  if (!error && response.statusCode === 200) {
                    let dataFromServer = JSON.parse(body)
                    let data = dataFromServer.data
                    console.log('Data from FB: ' + JSON.stringify(data))
                    let posts = data.map(post => {
                          let isLiked = post.likes ? true : false
                          return {
                            id: post.id,
                            image: '',
                            text: post.message,
                            name: post.from.name,
                            username: req.user.facebook.email,
                            liked: isLiked,
                            network: networks.facebook
                          }
                       })
                    req.fbposts = posts
                    console.log('Posts: ' + JSON.stringify(req.fbposts))
                  } else {
                    console.log('Error: ' + error)
                  }
                  next()
                 }, {spread: true}))
      }(), next)
    }

    // Twitter Timeline
    app.get('/timeline', isLoggedIn, getFacebookFeeds, then(async (req, res) => {
        try{
                let twitterClient = new Twitter({
                    consumer_key: twitterConfig.consumerKey,
                    consumer_secret: twitterConfig.consumerSecret,
                    access_token_key: req.user.twitter.token,
                    access_token_secret: req.user.twitter.tokenSecret
                })

                console.log('consumerKey: ' + twitterConfig.consumerKey)
                console.log('consumerSecret: ' + twitterConfig.consumerSecret)
                console.log('access_token_key: ' + req.user.twitter.token)
                console.log('access_token_secret: ' + req.user.twitter.tokenSecret)
                console.log('FB consumerKey: ' + facebookconfig.consumerKey)
                console.log('FB consumerSecret: ' + facebookconfig.consumerSecret)
                console.log('FB access_token_key: ' + req.user.facebook.token)
                console.log('FB access_token_secret: ' + req.user.facebook.tokenSecret)
                let [tweets] = await twitterClient.promise.get('statuses/home_timeline')
                console.log('tweets array: ' + tweets)
                tweets = tweets.map(tweet => {
                  return {
                    id: tweet.id_str,
                    image: tweet.user.profile_image_url,
                    text: tweet.text,
                    name: tweet.user.name,
                    username: '@' + tweet.user.screen_name,
                    liked: tweet.favorited,
                    network: networks.twitter
                  }
                })
                req.tweets = tweets

                console.log('Posts: ' + JSON.stringify(req.tweets))
                let posts = req.tweets
                posts = req.fbposts.reduce( function(coll, item){
                coll.push( item )
                return coll
                }, posts)
                console.log('posts: ' + posts)
                res.render('timeline.ejs', {
                        posts: posts
                })
        }catch(e){
          console.log(e.stack)
          //e.stack()
        }
    }))

    // Post Tweets
    app.get('/compose', isLoggedIn, (req, res) => {
        res.render('compose.ejs', {
            message: req.flash('error')
        })
    })

    // Post Tweets
    app.post('/compose', isLoggedIn, then(async (req, res) => {
        let status = req.body.text
        let postnetwork = req.body.postnetwork
        console.log('postnetwork is ' +postnetwork)
        if(postnetwork === 'twitter'){
        let twitterClient = new Twitter({
            consumer_key: twitterConfig.consumerKey,
            consumer_secret: twitterConfig.consumerSecret,
            access_token_key: req.user.twitter.token,
            access_token_secret: req.user.twitter.tokenSecret
        })
        if(status.length > 140){
            return req.flash('error', 'Status cannot be more than 140 characters!')
        }

        if(!status){
            return req.flash('error', 'Status cannot be empty!')
        }
        await twitterClient.promise.post('statuses/update', {status})
    }else if(postnetwork === 'facebook'){
        //To post it to FB
        let url = 'https://graph.facebook.com/v2.2/me/feed?access_token=' + req.user.facebook.token + '&message=' + status
            console.log('URL: ' + url)
             await request.promise.post(url,
                nodeifyit(async (error, response, body) => {
                  if (!error && response.statusCode === 200) {
                    let dataFromServer = JSON.parse(body)
                    let data = dataFromServer.data
                    console.log('Data from FB: ' + JSON.stringify(data))
                  } else {
                    console.log('Error: ' + error + '\nresponse: ' + response + '\nbody: ' + body)
                  }
                res.end()
                 }, {spread: true}))
         }
        res.redirect('/timeline')

    }))

    // Like
    app.post('/like/:network/:id', isLoggedIn, then(async (req, res) => {

        let network = req.params.network
        let id = req.params.id
        if(network === "twitter"){
            let twitterClient = new Twitter({
                consumer_key: twitterConfig.consumerKey,
                consumer_secret: twitterConfig.consumerSecret,
                access_token_key: req.user.twitter.token,
                access_token_secret: req.user.twitter.tokenSecret
            })
            await twitterClient.promise.post('favorites/create', {id})
            res.end()
        } else if(network === "facebook") {
            console.log('Like the post: ' + id)
            let postId = id.split('_')
            let url = 'https://graph.facebook.com/v2.2/' + postId[1] + '/likes?access_token=' + req.user.facebook.token
            console.log('URL: ' + url)
             await request.promise.post(url,
                nodeifyit(async (error, response, body) => {
                  if (!error && response.statusCode === 200) {
                    let dataFromServer = JSON.parse(body)
                    let data = dataFromServer.data
                    console.log('Data from FB: ' + JSON.stringify(data))
                  } else {
                    console.log('Error: ' + error + '\nresponse: ' + response + '\nbody: ' + body)
                  }
                res.end()
                 }, {spread: true}))
        }
    }))

    // Unlike
    app.post('/unlike/:network/:id', isLoggedIn, then(async (req, res) => {
        let network = req.params.network
        let id = req.params.id
        if(network === "twitter"){
            let twitterClient = new Twitter({
                consumer_key: twitterConfig.consumerKey,
                consumer_secret: twitterConfig.consumerSecret,
                access_token_key: req.user.twitter.token,
                access_token_secret: req.user.twitter.tokenSecret
            })
            await twitterClient.promise.post('favorites/destroy', {id})
            res.end()
        } else if(network === "facebook") {
            console.log('Remove like for the post: ' + id)
            let postId = id.split('_')
            let url = 'https://graph.facebook.com/v2.2/' + postId[1] + '/likes?access_token=' + req.user.facebook.token
            console.log('URL: ' + url)
             await request.promise.del(url,
                nodeifyit(async (error, response, body) => {
                  if (!error && response.statusCode === 200) {
                    let dataFromServer = JSON.parse(body)
                    let data = dataFromServer.data
                    console.log('Data from FB: ' + JSON.stringify(data))
                  } else {
                    console.log('Error: ' + error + '\nresponse: ' + response + '\nbody: ' + body)
                  }
                res.end()
                 }, {spread: true}))
        }
    }))

    // Twitter - Reply
    app.get('/reply/:network/:id', isLoggedIn, then(async (req, res) => {
        let network = req.params.network
        let id = req.params.id
        if(network === 'twitter'){
            let twitterClient = new Twitter({
                consumer_key: twitterConfig.consumerKey,
                consumer_secret: twitterConfig.consumerSecret,
                access_token_key: req.user.twitter.token,
                access_token_secret: req.user.twitter.tokenSecret
            })
            let [tweet] = await twitterClient.promise.get('statuses/show/', {id})
              let post = {
                id: tweet.id_str,
                image: tweet.user.profile_image_url,
                text: tweet.text,
                name: tweet.user.name,
                username: '@' + tweet.user.screen_name,
                liked: tweet.favorited,
                network: networks.twitter
              }
            res.render('reply.ejs', {
                post: post
            })
        } else if (network === 'facebook') {
            let url = 'https://graph.facebook.com/v2.2/' + id + '?access_token=' + req.user.facebook.token
            console.log('URL: ' + url)
            let post
             await request.promise.get(url,
                nodeifyit(async (error, response, body) => {
                  if (!error && response.statusCode === 200) {
                    let dataFromServer = JSON.parse(body)
                    console.log('Data from FB: ' + JSON.stringify(dataFromServer))
                    let isLiked = dataFromServer.likes ? true : false
                    post = {
                        id: dataFromServer.id,
                        image: '',
                        text: dataFromServer.message,
                        name: dataFromServer.from.name,
                        username: req.user.facebook.email,
                        liked: isLiked,
                        network: networks.facebook
                    }
                  } else {
                    console.log('Error: ' + error + '\nresponse: ' + response + '\nbody: ' + body)
                  }
                res.render('reply.ejs', {
                    post: post
                })
                 }, {spread: true}))
        }
    }))

    // Twitter - post reply
    app.post('/reply/:network/:id', isLoggedIn, then(async (req, res) => {
        let network = req.params.network
        let id = req.params.id
        let status = req.body.text
        if(network === 'twitter'){
            console.log(status)
            let twitterClient = new Twitter({
                consumer_key: twitterConfig.consumerKey,
                consumer_secret: twitterConfig.consumerSecret,
                access_token_key: req.user.twitter.token,
                access_token_secret: req.user.twitter.tokenSecret
            })
            if(status.length > 140){
                return req.flash('error', 'Status cannot be more than 140 characters!')
            }

            if(!status){
                return req.flash('error', 'Status cannot be empty!')
            }
            let id = req.params.id
            await twitterClient.promise.post('statuses/update', {status: status, in_reply_to_status_id: id})
            res.redirect('/timeline')
        } else if (network === 'facebook'){
            let url = 'https://graph.facebook.com/v2.2/' + id + '/comments?message=' + status + '&access_token=' + req.user.facebook.token
            console.log('Reply to the post on URL: ' + url)
             await request.promise.post(url,
                nodeifyit(async (error, response, body) => {
                  if (!error && response.statusCode === 200) {
                    let dataFromServer = JSON.parse(body)
                    let data = dataFromServer.data
                    console.log('Data from FB: ' + JSON.stringify(data))
                  } else {
                    console.log('Error: ' + error + '\nresponse: ' + response + '\nbody: ' + body)
                  }
                res.redirect('/timeline')
                 }, {spread: true}))
        }

    }))

    // Twitter - Share
    app.get('/share/:network/:id', isLoggedIn, then(async (req, res) => {
        let network = req.params.network
        let id = req.params.id
        if(network === 'twitter'){
            let twitterClient = new Twitter({
                consumer_key: twitterConfig.consumerKey,
                consumer_secret: twitterConfig.consumerSecret,
                access_token_key: req.user.twitter.token,
                access_token_secret: req.user.twitter.tokenSecret
            })
            let [tweet] = await twitterClient.promise.get('statuses/show/', {id})
              let post = {
                id: tweet.id_str,
                image: tweet.user.profile_image_url,
                text: tweet.text,
                name: tweet.user.name,
                username: '@' + tweet.user.screen_name,
                liked: tweet.favorited,
                network: networks.twitter
              }
            res.render('reply.ejs', {
                post: post
            })
        } else if (network === 'facebook') {
            let url = 'https://graph.facebook.com/v2.2/' + id + '?access_token=' + req.user.facebook.token
            console.log('URL: ' + url)
            let post
             await request.promise.get(url,
                nodeifyit(async (error, response, body) => {
                  if (!error && response.statusCode === 200) {
                    let dataFromServer = JSON.parse(body)
                    console.log('Data from FB: ' + JSON.stringify(dataFromServer))
                    let isLiked = dataFromServer.likes ? true : false
                    post = {
                        id: dataFromServer.id,
                        image: '',
                        text: dataFromServer.message,
                        name: dataFromServer.from.name,
                        username: req.user.facebook.email,
                        liked: isLiked,
                        network: networks.facebook
                    }
                  } else {
                    console.log('Error: ' + error + '\nresponse: ' + response + '\nbody: ' + body)
                  }
                res.render('share.ejs', {
                    post: post
                })
                 }, {spread: true}))
        }
    }))

 // Twitter - share
    app.post('/share/:id', isLoggedIn, then(async (req, res) => {
        try{
                let status = req.body.text
                let twitterClient = new Twitter({
                    consumer_key: twitterConfig.consumerKey,
                    consumer_secret: twitterConfig.consumerSecret,
                    access_token_key: req.user.twitter.token,
                    access_token_secret: req.user.twitter.tokenSecret
                })
                if(status.length > 140){
                    return req.flash('error', 'Status cannot be more than 140 characters!')
                }

                // if(!status){
                //     return req.flash('error', 'Status cannot be empty!')
                // }
                let id = req.params.id
                console.log('id: ' + id)
                await twitterClient.promise.post('statuses/retweet', {id})
                res.redirect('/timeline')
            } catch (e){
                console.log(e)
            }
    }))


return passport

  
  // Your routes here... e.g., app.get('*', handler)
}
