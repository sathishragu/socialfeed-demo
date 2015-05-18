let multiparty = require('multiparty')
let then = require('express-then')
let fs = require('fs')
let DataUri = require('datauri')
let nodeify = require('bluebird-nodeify')

let User = require('./models/user')
let Twitter = require('twitter')
//let Comment = require('./models/comment')
let isLoggedIn = require('./middlewares/isLoggedIn')
let FB = require('fb')

module.exports = (app) => {
  let passport = app.passport
  let twitterConfig = app.config.auth.twitterAuth
  let facebookconfig = app.config.auth.facebookAuth
    let networks = {
        twitter: {
            network: {
              icon: 'twitter',
              name: 'twitter',
              class: 'btn-primary'
            }
        },
        facebook: {
            network: {
              icon: 'facebook',
              name: 'facebook',
              class: 'btn-info'
            }
        },
        google: {
            network: {
              icon: 'google-plus',
              name: 'google',
              class: 'btn-danger'
            }
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
    let facebookScope = ['email, publish_actions, user_posts']
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

    // Twitter Timeline
    app.get('/timeline', isLoggedIn, then(async (req, res) => {
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
                console.log('tweets: ' + JSON.stringify(tweets))

                //To get FB posts

                /*let fbclient = new FB(
                        {
                            appID: facebookconfig.consumerKey,
                            secret: facebookconfig.consumerSecret
                        }
                    )
                let FBposts = await fbclient.promise.api({relative_url: 'me/feed', method: 'get'})
                FB.setAccessToken(req.user.facebook.token)
                console.log('before FBPOSTS')
                let FBposts = await FB.promise.api('/me/feed')*/
                FB.setAccessToken(req.user.facebook.token)
                //let FBposts = await FB.promise.api('/me/feed/')
                /*FB.api('', 'post' , {batch: [ { method: 'get', relative_url: '/me/feed' } ]}, function (res) {
  if(!res || res.error) {
    console.log(!res ? 'error occurred' : res.error);
    return;
  }
  console.log(JSON.stringify(res));
  //console.log(JSON.stringify(res))
});
                console.log('FBPOSTS')*/
                //console.log('FBposts: ' + JSON.stringify(FBposts))
                res.render('timeline.ejs', {
                    posts: tweets
                })}catch(e){
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
        res.redirect('/timeline')

    }))

    // Like
    app.post('/like/:id', isLoggedIn, then(async (req, res) => {

        let twitterClient = new Twitter({
            consumer_key: twitterConfig.consumerKey,
            consumer_secret: twitterConfig.consumerSecret,
            access_token_key: req.user.twitter.token,
            access_token_secret: req.user.twitter.tokenSecret
        })
        let id = req.params.id
        await twitterClient.promise.post('favorites/create', {id})
        res.end()

    }))

    // Like
    app.post('/unlike/:id', isLoggedIn, then(async (req, res) => {
       try{
           let twitterClient = new Twitter({
               consumer_key: twitterConfig.consumerKey,
               consumer_secret: twitterConfig.consumerSecret,
               access_token_key: req.user.twitter.token,
               access_token_secret: req.user.twitter.tokenSecret
           })
       let id = req.params.id
       await twitterClient.promise.post('favorites/destroy', {id})
       res.end()
        } catch(e){
            console.log(e)
        }
    }))

    // Twitter - Reply
    app.get('/reply/:id', isLoggedIn, then(async (req, res) => {
        try{
                let twitterClient = new Twitter({
                    consumer_key: twitterConfig.consumerKey,
                    consumer_secret: twitterConfig.consumerSecret,
                    access_token_key: req.user.twitter.token,
                    access_token_secret: req.user.twitter.tokenSecret
                })
                let id = req.params.id
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

                console.log('post: ' + JSON.stringify(post))
                console.log('post image: ' + post.image)
                res.render('reply.ejs', {
                    post: post
                })}catch(e){
                  console.log(e)
                  //e.stack()
                }
    }))
    // Twitter - post reply
    app.post('/reply/:id', isLoggedIn, then(async (req, res) => {
        try{
                let status = req.body.text
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
            } catch (e){
                console.log(e)
            }
    }))

    // Twitter - Share
    app.get('/share/:id', isLoggedIn, then(async (req, res) => {
        try{
                let twitterClient = new Twitter({
                    consumer_key: twitterConfig.consumerKey,
                    consumer_secret: twitterConfig.consumerSecret,
                    access_token_key: req.user.twitter.token,
                    access_token_secret: req.user.twitter.tokenSecret
                })
                let id = req.params.id
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

                console.log('post: ' + JSON.stringify(post))
                console.log('post image: ' + post.image)
                res.render('share.ejs', {
                    post: post
                })}catch(e){
                  console.log(e)
                  //e.stack()
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
