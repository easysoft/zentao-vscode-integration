// const vscode = require('vscode');
const {default: axios} = require('axios');

// 与禅道 API 通讯
class zentaoAPI {
    constructor(context) {
        /**
         * @type {vscode.ExtensionContext}
         */
        this._context = context;

        /**
         * @type {string}
         */
        this._token = '';

        /**
         * @type {string}
         */
        this._baseURL = '';
    }

    /**
     * 存储禅道登录地址、凭据信息
     * @param {object} credentials 登录信息
     * @param {string} [credentials.url] 禅道地址
     * @param {string} [credentials.account] 用户名
     * @param {string} [credentials.password] 密码
     * @param {string} [credentials.token] token
     * @returns {Promise}
     */
    setCredentials(credentials) {
        const storePromises = [];
        for (const key in credentials) {
            if (Object.hasOwnProperty.call(credentials, key)) {
                storePromises.push(this._context.secrets.store(key, credentials[key]));
            }
        }
        return Promise.allSettled(storePromises);
    }

    /**
     * 获取存储的禅道登录地址、凭据信息
     * @returns {Promise}
     */
    getCredentials() {
        const storePromises = ['url', 'account', 'password', 'token'].map(key => storePromises.push(this._context.secrets.get(key)));
        return Promise.allSettled(storePromises);
    }

    /**
     * 获取当前用户
     * @returns {object} 当前登录的用户
     */
    async getCurrentUser() {
        const response = await axios.get(`${this._baseURL}api.php/v1/user`, {
            headers: {'Content-Type': 'application/json', Token: this._token}
        });
        return response.data.profile;
    }

    /**
     * 登录禅道
     * @param {object} credentials 凭据
     * @param {string} [credentials.url] 禅道地址
     * @param {string} [credentials.account] 用户名
     * @param {string} [credentials.password] 密码
     */
    async login(credentials) {
        if (credentials) {
            await this.setCredentials(credentials);
        } else {
            credentials = await this.getCredentials();
        }

        if (!credentials.token) {
            const response = await axios.post(`${credentials.url}api.php/v1/tokens`, {account: credentials.account, password: credentials.password}, {
                headers: {'Content-Type': 'application/json'}
            });

            const {token} = response.data;
            this._token = token;
            this._baseURL = credentials.url;
            await this.setCredentials({token});
        }
        return await this.getCurrentUser(credentials);
    }
}

module.exports = {
    zentaoAPI
};
