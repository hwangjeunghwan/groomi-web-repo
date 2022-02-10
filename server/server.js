const dotenv = require('dotenv');
dotenv.config();
const userdb = require('../server/config/userDatabase.js');
const Users = require('../server/models/userModel.js');
const bcrypt = require('bcrypt');
const cors = require('cors');
const axios = require('axios');


var express = require('express'),
    http = require('http'),
    path = require('path'),
    bodyParser = require('body-parser'),
    static = require('serve-static'),
    cookieParser = require('cookie-parser'),
    expressSession = require('express-session');
var app = express();
var router = express.Router();

const mysql = require('mysql2/promise');
const dbconfig = require('../server/config/database'); // 데이터베이스 설정파일 경로
const connection = mysql.createPool(dbconfig);
const mysqlStore = require('express-mysql-session')(expressSession);
const sessionStore = new mysqlStore({}, connection);

app.use(expressSession({
    secret: 'goormi',
    store: sessionStore,
    resave: false,
    proxy: true,
    saveUninitialized: false, cookie: { maxAge: 60000 * 60 }
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use('/', router);
app.use('/public', static(path.join(__dirname, 'public')));

app.get('/',(req,res) => {
    if (req && req.session && req.session.user) {
      console.log('/process/product 호출됨 // session : ' + req.session.user.email);
      res.redirect('/public/main.home.html');
    } else {
      console.log('/process/product 호출됨 // session : ' + req.session.user);
      res.redirect('/public/sign.in.html');
    }
});

app.get('/health',(req,res) => {
	res.send(200); // 이게 맞는지는 모르겠어요
});




router.route('/process/login').post(async (req, res) => {
    try{
      const user = await Users.findAll({
          where:{
              email: req.body.email
          }
      });
      const match = await bcrypt.compare(req.body.password, user[0].password);
      if(!match) {return res.status(400).json({msg: "Wrong Password"}); console.log("Wrong password")} // unreachable code
      // session 생성
      if (req && req.session && req.session.user){ console.log("Already logined");}
      else{
        req.session.user = { email : req.body.email };
      }
      res.redirect('/');
    } catch (error) {
        res.status(404).json({msg:"Email not found // error :  " + error});
    }
});

router.route('/process/logout').get(function(req, res){
        console.log('/process/logout 호출됨');

        if(req && req.session && req.session.user){
            console.log('로그아웃');
            req.session.destroy(function(err){
                if(err) throw err;
                console.log('세션 삭제하고 로그아웃됨');
                res.redirect('/public/sign.in.html');
            });
        }
        else{
            console.log('로그인 상태 아님');
            res.redirect('/public/sign.in.html');
        }
    });

router.route('/process/register').post(async (req, res) => {
  const { email, password, confPassword, period_nohome, num_dependents, period_subscription } = req.body;
  if(password !== confPassword) return res.status(400).json({msg: "Password and Confirm Password is different"});
  try {
    const user = await Users.findAll({
        where:{
            email: req.body.email
        }
    });
    if(user.length === 0){
      const salt =  await bcrypt.genSalt();
      const hashPassword = await bcrypt.hash(password, salt);
      await Users.create({
          email: email,
          password: hashPassword,
          period_nohome: period_nohome,
          num_dependents: num_dependents,
          period_subscription: period_subscription
      });
      console.log("Register Success");
      res.redirect('/public/main.home.html');
      // res.json({msg: "Register Success"});
    }else {console.log("Already exist email"); res.redirect('/')}
  } catch (error) {
        console.log(error);
  }
})

// Front 단에서 쿼리를 Server단에 보낸다.
app.post('/connect_db', (req, res) => {
    req.setTimeout(0) // 시간 제한 없음
    connection.query(req.body.query)
    .then(([ rows ]) => res.send(rows))
    .catch(error => { if(error.code != 'ER_DUP_ENTRY') console.log(error) })
});

// session
app.get('/session_user', (req, res) => {
  if(req && req.session && req.session.user){
      // console.log(req.session.user);
      res.send(req.session.user);
  }
  else{
        res.send('null');
      console.log('로그인 상태 아님');
  }
});

//API 분양정보 조회
const GetLttotPblancList = async() =>{
    // API 호출
    let nowDate = new Date()
    let nextDate = new Date()
    nextDate.setMonth(nextDate.getMonth()+1)

    let startmonth = nowDate.getFullYear().toString() + ("00"+(nowDate.getMonth() + 1).toString()).slice(-2)
    let endmonth = nextDate.getFullYear().toString() + ("00"+(nextDate.getMonth() + 1).toString()).slice(-2)
    console.log(startmonth)
    let URL = `https://openapi.reb.or.kr/OpenAPI_ToolInstallPackage/service/rest/ApplyhomeInfoSvc/getLttotPblancList?serviceKey=xAgM3EBDlVEz1d%2FZFyQJwuDBmrs%2FRain5Farc%2FXCYhRPx6wJSHwHG2by0pEQ2newDCW5XUEgsxVVDHVlZBB18A%3D%3D&startmonth=${startmonth}&endmonth=${endmonth}`
    await axios.get(URL).then(response=> {
        let array = response.data.response.body?.items?.item
        // DB 저장
        if(array != undefined){
            console.log("API UPDATE")
            for(let i=0; i < array.length; i++){
                let data = array[i]
                connection.query(`INSERT INTO api_apt( houseManageNo, houseDtlSecdNm, houseNm, rceptBgnde, rceptEndde, sido ) VALUES( ${data.houseManageNo}, '${data.houseDtlSecdNm}', '${data.houseNm}', '${data.rceptBgnde}', '${data.rceptEndde}', '${data.sido}' )`)
                .catch(error => { if(error.code != 'ER_DUP_ENTRY') console.log(error) })
                GetAPTLttotPblancDetail(data.houseManageNo, data.pblancNo)
                GetAPTLttotPblancMdl(data.houseManageNo, data.pblancNo)
            }
        }
    }).catch(error =>{
        console.log(error)
    });
}

// 아파트 분양정보 상세조회
const GetAPTLttotPblancDetail = async (houseManageNo, pblancNo) => {
    let URL = `https://openapi.reb.or.kr/OpenAPI_ToolInstallPackage/service/rest/ApplyhomeInfoSvc/getAPTLttotPblancDetail?serviceKey=xAgM3EBDlVEz1d%2FZFyQJwuDBmrs%2FRain5Farc%2FXCYhRPx6wJSHwHG2by0pEQ2newDCW5XUEgsxVVDHVlZBB18A%3D%3D&houseManageNo=${houseManageNo}&pblancNo=${pblancNo}`
    await axios.get(URL).then(response=> {
        let data = response.data.response.body?.items?.item
        let query = data.gnrlrnk1etcggrcptdepd == undefined ? `INSERT INTO api_apt_details( houseManageNo, hssplyAdres, spsplyRceptBgnde, spsplyRceptEndde, gnrlRnk1CrspareaRceptPd, gnrlRnk1EtcAreaRcptdePd, gnrlRnk2CrspareaRceptPd, gnrlRnk2EtcAreaRcptdePd ) VALUES( ${houseManageNo}, '${data.hssplyadres}', '${data.spsplyrceptbgnde}', '${data.spsplyrceptendde}', '${data.gnrlrnk1crsparearceptpd}', '${data.gnrlrnk1etcarearcptdepd}', '${data.gnrlrnk2crsparearceptpd}', '${data.gnrlrnk2etcarearcptdepd}' )`
         : `INSERT INTO api_apt_details( houseManageNo, hssplyAdres, spsplyRceptBgnde, spsplyRceptEndde, gnrlRnk1CrspareaRceptPd, gnrlRnk1EtcGGRcptdePd, gnrlRnk1EtcAreaRcptdePd, gnrlRnk2CrspareaRceptPd, gnrlRnk2EtcGGRcptdePd, gnrlRnk2EtcAreaRcptdePd ) VALUES( ${houseManageNo}, '${data.hssplyadres}', '${data.spsplyrceptbgnde}', '${data.spsplyrceptendde}', '${data.gnrlrnk1crsparearceptpd}', '${data.gnrlrnk1etcggrcptdepd}', '${data.gnrlrnk1etcarearcptdepd}', '${data.gnrlrnk2crsparearceptpd}', '${data.gnrlrnk2etcggrcptdepd}', '${data.gnrlrnk2etcarearcptdepd}' )`
        // DB 저장
        connection.query(query)
        .catch(error => { if(error.code != 'ER_DUP_ENTRY') console.log(error) });
    }).catch(error =>{
        console.log(error)
    });
}

// 아파트 분양정보 주택형별 상세조회
const GetAPTLttotPblancMdl = async (houseManageNo, pblancNo) => {
    let URL = `https://openapi.reb.or.kr/OpenAPI_ToolInstallPackage/service/rest/ApplyhomeInfoSvc/getAPTLttotPblancMdl?serviceKey=xAgM3EBDlVEz1d%2FZFyQJwuDBmrs%2FRain5Farc%2FXCYhRPx6wJSHwHG2by0pEQ2newDCW5XUEgsxVVDHVlZBB18A%3D%3D&houseManageNo=${houseManageNo}&pblancNo=${pblancNo}`
    await axios.get(URL).then(response=> {
        let data = response.data.response.body?.items?.item
        let dataLength = data.length
        let housety = ""
        if (dataLength == undefined){
            housety = data.housety
        }else{
            for(let i=0; i < dataLength; i++){
                housety += data[i].housety
                if(i != dataLength - 1){
                    housety += ", "
                }
            }
        }

        // DB 저장
        connection.query(`INSERT INTO api_apt_type_details( houseManageNo, houseTy ) VALUES( ${houseManageNo}, '${housety}' )`)
        .catch(error => { if(error.code != 'ER_DUP_ENTRY') console.log(error) });
    }).catch(error =>{
        console.log(error)
    });
}

// API 호출 + DB 저장
GetLttotPblancList()
// API 관련 함수 주기( 하루 )마다 반복 수행
setInterval( GetLttotPblancList, 86400000 );


// 30020 서버 포트
app.listen(30020, async (err) => {
    if(err) return console.log(err);
    else{
        console.log("Server is listening on port 30020");
    }
});
