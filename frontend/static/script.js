const signinModal = new bootstrap.Modal('#signinModal', {})
const signin = document.getElementById('signin')
let obj = {}
let id

document.getElementById('logo').addEventListener('change', e => {
    const file = e.target.files[0]
    var reader = new FileReader()
    reader.onload = function () {
        newQRcode(reader.result)
    }
    reader.readAsDataURL(file)
})

signin.addEventListener('submit', e => {
    e.preventDefault()
    const email = signin.iEmail.value
    const pass = signin.iPassword.value
    // console.log(email, pass)
    postData('/user/signin', { email, pass }).then(data => {
        obj = data
        // console.log(obj.token)
        signinModal.hide()
    })
})

function newQRcode(logo) {
    id = crypto.randomUUID()
    const el = document.getElementById("qrcode")
    el.innerHTML = ''
    const cfg = {
        text: 'qrc-t8zw.onrender.com/qr/g/' + id,
        correctLevel: QRCode.CorrectLevel.M,
        logo: logo,
        logoWidth: 50,
        logoHeight: 50,
    }
    qrcode = new QRCode(el, cfg)
}

function statQRcode(from) {
    console.log(from)
    getData('/qr/stat/' + from).then(data => {
        console.log(data)
        const groups = data.reduce((groups, v) => {
            const date = v.createdAt.split('T')[0]
            if (!groups[date]) {
                groups[date] = 0
            }
            groups[date]++
            return groups
        }, {})

        const arr = []
        for (const d in groups) {
            const ts = new Date(d)
            arr.push({ x: ts.valueOf(), y: groups[d] })
        }

        chart.data.datasets[0].data = arr
        chart.update()


    }).catch(exp => {
        console.log(exp)
    })
}

function listQRcodes() {
    getData('/qr/user').then(data => {
        console.log(data)
        const list = document.getElementById('list-qrcodes')
        list.innerHTML = ''
        for (const v of data) {
            const li = document.createElement('li')
            li.innerHTML = `<p>${v.to}</p>`
            const a = document.createElement('button')
            a.classList.add("btn", "btn-info", "btn-sm")
            a.onclick = () => { statQRcode(v.from) }
            a.innerText = 'Show statistics'
            li.append(a)
            list.append(li)
        }
    }).catch(exp => {
        signinModal.show()
    })
}

function deleteQRcode(from = '') {
    deleteData('/qr/user/' + from).then(data => {
        console.log(data)
    })
}

async function postData(url = '', data = {}) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + obj.token },
        body: JSON.stringify(data) // body data type must match "Content-Type" header
    })
    if (response.ok) {
        return response.json()
    } else {
        throw Error(response.status)
    }
}

async function getData(url = '') {
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + obj.token },
    })
    if (response.ok) {
        return response.json()
    } else {
        throw Error(response.status)
    }
}

async function deleteData(url = '') {
    const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + obj.token },
    })
    return response.json()
}
// https://github.com/ushelp/EasyQRCodeJS
const config = {
    correctLevel: QRCode.CorrectLevel.M,
    logoWidth: 50,
    logoHeight: 50,
}
let qrcode = new QRCode(document.getElementById("qrcode"), config)
newQRcode()

function downloadQRcode() {
    const to = document.getElementById("url-input").value
    postData('/qr/user', { from: id, to }).then(data => {
        console.log(data)
        const fileName = 'EasyQRCode'
        qrcode.download(fileName)
    }).catch(exp => {
        signinModal.show()
        console.log(exp)
    })
}

const options = {
    type: 'bar',
    data: {
        datasets: [{
            label: 'per day',
            data: [],
            borderColor: 'green',
            backgroundColor: 'green'
        }]
    },
    options: {
        responsive: true,
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'day',
                    round: 'day'
                }
            }
        }
    }
}
const ctx = document.getElementById('statistics').getContext('2d');
const chart = new Chart(ctx, options);