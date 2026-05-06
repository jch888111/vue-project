const a = ['test1', 'test2', 'test3', 'test4', 'test5'];
const main = () => {
    for (const item of a) {
        if (item === 'test3') {
            return; // break 跳出整个循环 for循环里不执行 return 跳出整个函数
        }
        console.log(item);
    }
    console.log('end');
}
main();