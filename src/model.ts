import { Sequelize, Model, DataTypes } from 'sequelize';
import { config } from './config';


const sequelize = new Sequelize({
    ...config.database,
    dialect: 'postgres'
})


// async function createDb() {
//     const { database } = config.database
//     const sequelize = new Sequelize({
//         ...config.database,
//         database: 'postgres',
//         dialect: 'postgres',
//         // logging: console.log
//     })
//     await sequelize.authenticate();
//     const [results, metadata] = await sequelize.query(`SELECT 1 FROM pg_database WHERE datname = '${database}'`);
//     if (!results.length) {
//         await sequelize.query(`CREATE DATABASE "${database}";`);
//     }
//     sequelize.close()
// }


async function syncDb() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
        await sequelize.sync();
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
}


export class User extends Model {}

User.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    name: {
        type: DataTypes.STRING,
        validate: {
            is: /^[a-z]+(\s[a-z]+)*$/i,
        }
    }
}, {
    sequelize, modelName: 'User'
}
)

syncDb()