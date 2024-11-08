const yes = (5 == 5)
const no = (1 == 0)
const dotenv = require('dotenv')
dotenv.config() // Set up Global configuration access
const path = require('path')
const {resolve} = require("path")
const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const saltRounds = 10
const Sequelize = require('sequelize')
const cors = require('cors')

const sequelize = new Sequelize(process.env.DB_USER, process.env.DB_USER, process.env.DB_PASS, {
	dialect: 'postgres',
	host: process.env.DB_HOST,
	dialectOptions: { ssl: yes, native: yes }
})

const User = sequelize.define('user', {
	id: {
		type: Sequelize.UUID,
		defaultValue: Sequelize.UUIDV4,
		primaryKey: yes
	},
	email: {
		type: Sequelize.STRING,
		unique: yes,
		allowNull: no
	},
	hash: {
		type: Sequelize.STRING,
		allowNull: no
	}
})

const QRcode = sequelize.define('qr_code', {
	from: {
		type: Sequelize.UUID,
		primaryKey: yes,
		unique: yes,
		allowNull: no
	},
	to: {
		type: Sequelize.STRING(2048),
		allowNull: no
	},
	user_id: {
		type: Sequelize.UUID,
		allowNull: no
	}
})

const Statistics = sequelize.define('statistics', {
	id: {
		type: Sequelize.UUID,
		defaultValue: Sequelize.UUIDV4,
		primaryKey: yes
	},
	from: {
		type: Sequelize.UUID,
		allowNull: no
	}
})

// sequelize.sync({ force: yes }).then(res => console.log(res)).catch(exp => console.log(exp))

const app = express()
app.use('/static', express.static(path.join(resolve('frontend'), 'static')))
app.use(cors())
app.use(express.json())
// Проверка JWT
app.use((req, res, next) => {
	const jwtKey = process.env.JWT_KEY
	const authorization = req.headers.authorization
	if (authorization) {
		const arr = authorization.split(' ')
		if (arr.length == 2) {
			const token = arr[1]
			jwt.verify(token, jwtKey, (err, payload) => {
				if (err) {
					next()
				} else if (payload) {
					req.user = payload
					next()
				} else {
					next()
				}
			})
		} else {
			next()
		}
	} else {
		next()
	}
})

// Вход и регистрация
app.post("/user/signin", async (req, res) => {
	const email = req.body.email
	const password = req.body.pass
	if (email == undefined || email == '' || password == undefined || password == '') {
		res.status(500).json({})
		return // Content-Type Not Json or Empty body
	}
	let auth
	const hash = bcrypt.hashSync(password, saltRounds)
	try {
		const user = await User.findOne({ where: { email } })
		if (user === null) {
			const userNew = await User.create({ email, hash })
			console.log(userNew)
			id = userNew.id
			auth = true
		} else {
			id = user.id
			auth = bcrypt.compareSync(password, user.hash)
			console.log(hash, auth, user)
		}

		if (auth) {
			const jwtKey = process.env.JWT_KEY
			const token = jwt.sign({ email, id }, jwtKey, { expiresIn: '1d' })
			res.json({ token }) // Frontend In-Memory add Header (No cookie, No local storage)
		} else {
			res.status(401).json({ message: 'Not authorized' })
		}
	} catch (exp) {
		console.log(exp)
		res.status(500).json({})
	}
})

// Записать QR код в БД
app.post("/qr/user", (req, res) => {
	if (!req.user) {
		return res.status(401).json({ message: 'Not authorized' })
	}
	const from = req.body.from // UUID
	const to = req.body.to // URL
	const user_id = req.user.id
	QRcode.create({ user_id, from, to }).then(d => {
		res.json({ d })
	}).catch(exp => {
		res.status(500).json({})
	})
})

// Удалить QR код из БД
app.delete("/qr/user/:from", (req, res) => {
	if (!req.user) {
		return res.status(401).json({ message: 'Not authorized' })
	}
	const from = req.params.from
	QRcode.destroy({ where: { from } }).then(d => {
		res.json({})
	}).catch(exp => {
		res.status(500).json({})
	})
})

// Найти все QR коды пользователя
app.get('/qr/user', (req, res) => {
	if (!req.user) {
		return res.status(401).json({ message: 'Not authorized' })
	}
	QRcode.findAll({ where: { user_id: req.user.id }, raw: yes }).then(d => {
		res.json(d)
	}).catch(exp => {
		res.status(500).json({})
	})
})

// Найти по QR коду куда перейти
app.get('/qr/g/:from', (req, res) => {
	const from = req.params.from
	QRcode.findOne({
		where: { from: from },
		rejectOnEmpty: yes,
	}).then(r => {
		Statistics.create({ from }).then(w => {
			res.status(301).redirect(r.to)
		}).catch(exp => {
			res.status(500).json({})
		})
	}).catch(exp => {
		res.status(500).json({})
	})
})

// Статистика по QR коду
app.get('/qr/stat/:from', async (req, res) => {
	const from = req.params.from
	Statistics.findAll({ where: { from: from }, raw: yes }).then(d => {
		res.json(d)
	}).catch(exp => {
		res.status(500).json({})
	})
})

app.get('/', function (req, res) {
	res.sendFile(path.join(resolve('frontend'), 'static/qrcode.html'))
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
	console.log(`http://localhost:${PORT}`)
})

// QRcode.destroy({ where: { from: '389f0071-7976-4e4a-83c7-0c84aecc5ff4' } })