/**
 * sqlite相关操作 api
 * @author youyong
 */

/**
 * 判断数据库是否打开
 */
export function isOpen() {
	// 数据库打开了就返回true,否则返回false
	console.log("3453")
	let isOpen = plus.sqlite.isOpenDatabase({
		name: getApp().globalData.DATABASE_NAME,
		path: getApp().globalData.DATABASE_PATH,
	})

	return isOpen;
}

/**
 * 打开数据库
 */
export function openDb() {
	// 创建数据库或者打开
	return new Promise((resolve, reject) => {
		plus.sqlite.openDatabase({
			name: getApp().globalData.DATABASE_NAME,
			path: getApp().globalData.DATABASE_PATH,
			success(e) {
				resolve(e); //成功回调
			},
			fail(e) {
				reject(e); //失败回调
			}
		})
	})
}

/**
 * Sql查询
 * @param {Object} sql
 */
export function selectSql(sql) {
	console.log(sql);
	return new Promise((resolve, reject) => {
		//创建表格在executeSql方法里写
		plus.sqlite.selectSql({
			name: getApp().globalData.DATABASE_NAME,
			sql: sql,
			success(e) {
				resolve(e);
			},
			fail(e) {
				reject(e);
			}
		})
	})
}

/**
 * 执行Sql
 * @param {Object} sql
 */
export function executeSql(sql) {
	console.log(sql);
	return new Promise((resolve, reject) => {
		//创建表格在executeSql方法里写
		plus.sqlite.executeSql({
			name: getApp().globalData.DATABASE_NAME,
			sql: sql,
			success(e) {
				resolve(e);
			},
			fail(e) {
				reject(e);
			}
		})
	})
}

/**
 * 事务执行
 */
export function transaction(options = 'begin') {
	return new Promise((resolve, reject) => {
		void plus.sqlite.transaction({
			name: getApp().globalData.DATABASE_NAME,
			operation: options,
			success: function(e) {
				resolve(e)
			},
			fail: function(e) {
				reject(e)
			}
		});
	})
}

/**
 * 关闭数据库
 */
export function closeDb() {
	return new Promise((resolve, reject) => {
		plus.sqlite.closeDatabase({
			name: getApp().globalData.DATABASE_NAME,
			success(e) {
				resolve(e);
			},
			fail(e) {
				reject(e);
			}
		})
	})
}

/**
 * 初始化数据库
 */
export async function initDb() {
	await createDb();
}

/**
 * 创建数据库： 复制或升级
 */
async function createDb() {
	plus.io.resolveLocalFileSystemURL(getApp().globalData.DATABASE_PATH, function(entry) {
			console.log('upgradeDb')
			upgradeDb();
		},

		function(e) {
			console.log('copyDb')
			copyDb();
		}
	)
}

/**
 * 复制数据库
 */
function copyDb() {
	// 不存在则复制
	const init_db_path = '_www/static/init.db';
	plus.io.resolveLocalFileSystemURL(init_db_path, function(entry) {
		plus.io.resolveLocalFileSystemURL('_doc/', function(root) {
			entry.copyTo(root, getApp().globalData.DB_FILE, function() {
				console.log("copyDb success");
				upgradeDb();
			}, function() {
				console.log("copy error");
			})
		})
	})
}

/**
 * 升级数据库
 */
async function upgradeDb() {
	if (!isOpen()) {
		await openDb();
	}

	let sql = "select * from pdaParam where paramName = 'dbVer' limit 1";
	let pdaParams = await selectSql(sql);

	// 升级到版本1 
	let dbVer = 1;
	if (pdaParams && pdaParams.length == 1 && pdaParams[0].paramValue < dbVer) {
		// TODO: 升级代码

		// 更新数据库版本
		sql = `update pdaParam set paramValue = ${dbVer} where paramName = 'dbVer'`;
		await executeSql(sql);
	}

	// 升级到版本2 
	/* db_ver = 2; 
	if (pdaParams && pdaParams.length == 1 && pdaParams[0].paramValue < dbVer) {
		// TODO: 升级代码
		
		// 更新数据库版本
		sql = `update pdaParam set paramValue = ${dbVer} where paramName = 'dbVer'`;
		await executeSql(sql);
	} */

	await closeDb();
	uni.setStorageSync("dbVer", dbVer);

	console.log("upgradeDb success");
}
