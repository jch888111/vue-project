import dayjs from 'dayjs'

// 方法4：从指定时间获取
const specificTime = dayjs('2024-01-01 12:01:00')
const specificTimeString = specificTime.format('HH:mm:ss')
console.log('指定时间:', specificTimeString)  // 输出：12:01:00

// ❌ 错误：不能在字符串上调用 dayjs 方法
// const a = specificTimeString.hour()  // specificTimeString 是字符串，没有 hour() 方法

// ✅ 正确：在 dayjs 对象上调用方法
const a = specificTime.hour()      // 获取小时：12
const b = specificTime.minute()   // 获取分钟：1
const c = specificTime.second()   // 获取秒：0
console.log('时分秒:', a, b, c)    // 输出：12 1 0
