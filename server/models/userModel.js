const  { Sequelize } = require('sequelize');
const  db = require('../config/userDatabase.js');

const { DataTypes } = Sequelize;

const Users = db.define('user',{
    email:{
        type: DataTypes.STRING,
        primaryKey: true
    },
    password:{
        type: DataTypes.STRING
    },
    period_nohome:{
        type: DataTypes.INTEGER
    },
    num_dependents:{
        type: DataTypes.INTEGER
    },
    period_subscription:{
        type: DataTypes.INTEGER
    }
},{
    freezeTableName:true
});

module.exports = Users;
