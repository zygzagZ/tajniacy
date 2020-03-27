const gulp = require('gulp')
const sass = require('gulp-sass')
const babel = require('gulp-babel')
const postcss = require('gulp-postcss')
const autoprefixer = require('autoprefixer')
const sourcemaps = require('gulp-sourcemaps')
const cssnano = require('cssnano')
const rename = require('gulp-rename')
const browsersync = require('browser-sync').create()
const plumber = require('gulp-plumber')
const nodemon = require('gulp-nodemon')
const del = require('del')
const eslint = require('gulp-eslint')
const merge = require('merge-stream')

// Clean assets
function clean() {
  return del(['./dist/'])
}

function css() {
  const plugins = [autoprefixer(), cssnano()]

  return merge(
    gulp.src('./app/scss/**/*.scss')
      .pipe(sass().on('error', sass.logError)),
    gulp.src('./app/css/**/*.css'))
    .pipe(postcss(plugins))
    .pipe(rename({ suffix: '.min' }))
    .pipe(gulp.dest('./dist/app/css'))
    .pipe(browsersync.stream())
}

// Lint scripts
function scriptsLint() {
  return gulp
    .src(['./app/**/*.js', './server/**/*.js', './gulpfile.js'])
    .pipe(plumber())
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError())
}

function scripts() {
  // Bootstrap
  const bootstrap = gulp.src('./node_modules/bootstrap/dist/**/*')
    .pipe(gulp.dest('./dist/app/vendor/bootstrap'))

  // jQuery
  const jquery = gulp.src([
    './node_modules/jquery/dist/*',
    '!./node_modules/jquery/dist/core.js'
  ]).pipe(gulp.dest('./dist/app/vendor/jquery'))

  const others = ['app/js', 'server'].map((el) => {
    return merge(
      gulp.src(`./${el}/**/*.js`)
        .pipe(sourcemaps.init())
        .pipe(plumber({
          errorHandler: onError
        }))
        .pipe(babel({
          presets: ['@babel/preset-env']
        }))
        .pipe(sourcemaps.write('.')),
      gulp.src(`./${el}/**/*.json`))
      .pipe(gulp.dest(`./dist/${el}/`))
  })

  return merge(bootstrap, jquery, others)
}

function resources() {
  const files = gulp.src('./app/static/**/*')
    .pipe(gulp.dest('./dist/app/static'))

  const html = gulp.src('./app/*.html')
    .pipe(gulp.dest('./dist/app/'))

  return merge(files, html)
}

const onError = (err) => {
  console.log(err)
}

function run() {
  return nodemon({
    script: './dist/server/main.js'
  }).on('start', browsersync.reload)
}

function watch() {
  gulp.watch('./dist/app/**/*').on('change', browsersync.reload)
  gulp.watch(['./app/*.html', './app/static/**/*']).on('change', resources)
  gulp.watch('./app/css/**/*', css)
  gulp.watch(['./app/js/**/*.js', './server/**/*'], js)
}

function browserSync() {
  browsersync.init(null, {
    proxy: 'http://localhost:3000',
    files: ['./dist/app/**/*.*'],
    port: 7000,
    ws: true
  })
}

const js = gulp.series(scriptsLint, scripts)
const build = gulp.series(clean, gulp.parallel(css, js, resources))

module.exports = {
  nodemon,
  js,
  css,
  run,
  watch,
  browserSync,
  scripts,
  scriptsLint,
  build,
  default: gulp.series(build, gulp.parallel(watch, browserSync, run))
}
