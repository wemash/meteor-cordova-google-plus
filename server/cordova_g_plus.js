Accounts.registerLoginHandler(function (req) {
	if (!req.cordova_g_plus)
		return undefined

	check(req, {
		cordova_g_plus: Boolean,
		email: String,
		idToken: String,
		profile: Match.Any,
		sub: String
	})

	var user   = Meteor.users.findOne({"services.google.id": req.sub}),
			userId = null

	if (!user) {

		const reqOptions = {
			headers: {
				"User-Agent": "Meteor/1.0"
			},
			params: {
				id_token: req.idToken
			}
		}

		console.log('Attempting to get user info from Google', {
			reqOptions
		})

		try {
			var res = Meteor.http.get("https://www.googleapis.com/oauth2/v3/userinfo", reqOptions)
		} catch(e) {
			console.log(e)
		}

		console.log(res)

		if (res.error) {
			console.log("Hey, there was an error")
			console.log(res.error)
			return false
		}
		else {
			if (/* req.email == res.data.email && */ req.sub == res.data.sub) {
				var googleResponse = _.pick(res.data, "email", "email_verified", "family_name", "gender", "given_name", "locale", "name", "picture", "profile", "sub")

				googleResponse["accessToken"] = req.oAuthToken
				googleResponse["id"] = req.sub

				if (typeof(googleResponse["email"]) == "undefined") {
					googleResponse["email"] = req.email
				}

				var insertObject = {
					createdAt: new Date(),
					// profile: googleResponse,
					services: {
						google: googleResponse
					}
				}

				if (req.profile && (req.profile instanceof Array)) { // fill profile according to req.profile
					if (0 < req.profile.length) {
						insertObject.profile = {}

						for (var A = 0; A < req.profile.length; A++) {
							if (_.has(googleResponse, req.profile[A])) {
								insertObject.profile[req.profile[A]] = googleResponse[req.profile[A]]
							}
						}
					}
				}

				userId = Meteor.users.insert(insertObject)
			} else {
				throw new Meteor.Error(422, "AccessToken MISMATCH in hedcet:cordova-google-plus-native-sign-in package")
			}
		}
	} else
		userId = user._id

	var stampedToken = Accounts._generateStampedLoginToken()
	var stampedTokenHash = Accounts._hashStampedToken(stampedToken)

	Meteor.users.update({
		_id: userId
	}, {
		$push: {
			"services.resume.loginTokens": stampedTokenHash
		}
	})

	return {
		token: stampedToken.token,
		userId: userId
	}
})

