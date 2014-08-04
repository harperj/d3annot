module.exports = function(grunt) {
    grunt.initConfig({
        browserify: {
            injected: {
                src: ['js/injected.js'],
                dest: 'build/injected.js',
                bundleOptions: {
                    debug: true
                }
            },
            restyling: {
                src: ['js/restyling.js'],
                dest: 'build/restyling.js',
                bundleOptions: {
                    debug: true
                }
            }
        }
    });
    grunt.loadNpmTasks('grunt-browserify');
};