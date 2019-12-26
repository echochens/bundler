const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')//解析文件依赖
const traverse = require('@babel/traverse').default//遍历ast树
const babel = require('@babel/core')//安装babel/core转换代码

const moduleAnalyser = (filename) => {
  const content = fs.readFileSync(filename, 'utf-8');// 读取文件内容
  const ast = parser.parse(content, {//对输入的源代码字符串进行解析并生成初始 AST
    sourceType: "module"
  })

  // console.log(ast)

  // const dependices = ast.program.body;// 文件相关依赖
  const dependencies = {};// 得到依赖数组
  traverse(ast, {
    ImportDeclaration ({ node }) {//引入声明
      const dirname = path.dirname(filename)  //filename对应的文件夹路径
      const newFile = "./" + path.join(dirname, node.source.value)
      //变成对象，key是依赖路径，value是相对依赖路径。便于之后使用
      dependencies[node.source.value] = newFile.replace(/\\/g, '/');
    }
  })
  // console.log(dependencies)
  const { code } = babel.transformFromAst(ast, null, {
    presets: ['@babel/preset-env']//转换代码(将 ECMAScript 2015+ 版本的代码转换为向后兼容的 JS 语法)
  })//转换ast

  console.log(code)

  return {
    filename,
    dependencies,
    code
  }

}

// 获取依赖视图
const moduleDependenciesGraph = (entry) => {
  const entryModule = moduleAnalyser(entry)// 入口函数
  // console.log(entryModule)
  const graphArray = [entryModule];
  for (let i = 0; i < graphArray.length; i++) {
    const item = graphArray[i];
    const { dependencies } = item;
    if (dependencies) {
      for (let j in dependencies) {
        // console.log(dependencies[j])
        const data = moduleAnalyser(dependencies[j]);
        graphArray.push(data)
      }
    }

  }
// 转换为对象 便于使用
  const graph = {}
  graphArray.forEach(item => {
    graph[item.filename] = {
      dependencies: item.dependencies,
      code: item.code
    }
  })
  return graph;

}


const generateCode = (entry) => {
  const graph = (JSON.stringify(moduleDependenciesGraph(entry)))
  // console.log(graph)
  return `(function (graph) {
    function require (module) {
      console.log(module)
      function localRequire (relativePath) {
        return require(graph[module].dependencies[relativePath])
      }
      var exports = {};
      (function (require, exports, code) {
        eval(code)
      })(localRequire, exports, graph[module].code);
      return exports;
    };
    require('${entry}');
  })(${ graph})`;

}

const code = generateCode("./src/index.js");// 入口函数
// console.log(code);