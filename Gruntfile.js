module.exports = function(grunt) {
    grunt.initConfig({
        browserify: {
            options: {
                bundleOptions: {
                    debug: true
                }
            },
            injected: {
                src: ['js/injected.js'],
                dest: 'build/injected.js'
            },
            restyling: {
                src: ['js/restyling.js'],
                dest: 'build/restyling.js'
            }
        }
    });
    grunt.loadNpmTasks('grunt-browserify');
};