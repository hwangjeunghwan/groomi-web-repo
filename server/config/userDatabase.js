const {Sequelize} = require('sequelize');

const db = new Sequelize(process.env.rds_database, process.env.rds_user, process.env.rds_password,{
    host: process.env.rds_host,
    logging: console.log,
    maxConcurrentQueries: 100,
    dialect: 'mysql',
    ssl: 'Amazon RDS',
    pool: { maxConnections: 5, maxIdleTime: 30 },
    language: 'en'
});

module.exports = db;
