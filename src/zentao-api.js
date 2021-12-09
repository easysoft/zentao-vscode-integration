// const vscode = require('vscode');
const {default: axios} = require('axios');

// 与禅道 API 通讯
class zentaoAPI {
    constructor(context) {
        /**
         * 扩展上下文（扩展激活时创建的）
         * @type {vscode.ExtensionContext}
         */
        this._context = context;

        /**
         * API Token
         * @type {string}
         */
        this._token = '';

        /**
         * API URL
         * @type {string}
         */
        this._baseURL = '';

        // 初始化时获取上次保存的凭据
        context.secrets.get('token').then(token => {
            if (token) {
                this._token = token;
            }
        });
        context.secrets.get('url').then(url => {
            if (url) {
                this._baseURL = url;
            }
        });
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
     * GET 一个禅道 API
     * @param {string} path 路径
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    get(path) {
        return axios.get(`${this._baseURL}api.php/v1/${path}`, {
            headers: {'Content-Type': 'application/json', Token: this._token}
        });
    }

    /**
     * POST 一个禅道 API
     * @param {string} path 路径
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    post(path, data) {
        return axios.post(`${this._baseURL}api.php/v1/${path}`, data, {
            headers: {'Content-Type': 'application/json', Token: this._token}
        });
    }

    /**
     * 获取当前用户
     * @returns {object} 当前登录的用户
     */
    async getCurrentUser() {
        const response = await this.get('user');
        return response.data.profile;
    }

    /**
     * 登录禅道
     * @param {object} credentials 凭据
     * @param {string} [credentials.url] 禅道地址
     * @param {string} [credentials.account] 用户名
     * @param {string} [credentials.password] 密码
     * @returns {object} 当前登录的用户信息
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

    /**
     * 获取产品列表
     * @returns {object[]} 产品列表
     */
    async getProducts() {
        const response = await this.get('products');
        return response.data.products;
    }

    /**
     * 获取产品详情
     * @param {number} product 产品 ID
     * @returns {object} 产品
     */
    async getProduct(product) {
        const response = await this.get(`products/${product}`);
        return response.data;
    }

    /**
     * 获取产品的需求
     * @param {number} product 产品 ID
     * @returns {object[]} 需求列表
     */
    async getProductStories(product) {
        const response = await this.get(`products/${product}/stories`);
        return response.data.stories;
    }

    /**
     * 获取产品的 bugs
     * @param {number} product 产品 ID
     * @returns {object[]} bug 列表
     */
    async getProductBugs(product) {
        const response = await this.get(`products/${product}/bugs`);
        return response.data.bugs;
    }

    /**
     * 获取执行的任务列表
     * @param {number} execution 执行 ID
     * @returns {object[]} 任务列表
     */
    async getExecutionTasks(execution) {
        const response = await this.get(`executions/${execution}/tasks`);
        return response.data.tasks;
    }

    /**
     * 获取版本库列表
     * @returns {object[]} 版本库列表
     */
    async getRepos() {
        const response = await this.get('repos');
        return response.data.repos;
    }
}

module.exports = {
    zentaoAPI
};
