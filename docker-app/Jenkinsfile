import java.text.*

node {
    def yaml_path
    def version_tag
    
    def app_name = 'webarxaas'
    def namespace = 'default'
    def cluster = 'adeo.no'
    def test_cluster = 'preprod.local'
    def date = new Date()
    def datestring = new SimpleDateFormat("yyyy-MM-dd").format(date)

    try {
        stage('Clean workspace') {
            cleanWs()
        }


        stage('Checkout WebAaaS') {
            checkout(
                    scm: [$class           : 'GitSCM',
                          branches         : [[name: '*/master']],
                          extensions       : [[$class: 'RelativeTargetDirectory', relativeTargetDir: "${app_name}"]],
                          userRemoteConfigs: [[url: "https://github.com/oslomet-arx-as-a-service/WebARXaaS.git"]]]
            )
            def git_commit_hash = sh(script: "git --git-dir=./${app_name}/.git rev-parse --short HEAD", returnStdout: true).trim()
            version_tag = "${datestring}-${git_commit_hash}"
        }

        stage('Build react Deploy') {
            dir("${app_name}") {
                sh "yarn"
                sh "yarn build"
            }
        }

        stage('Build docker image') {
            dir("${app_name}") {
                app = docker.build("${app_name}")
            }
        }
        
        stage('Push docker image') {
            docker.withRegistry('https://repo.adeo.no:5443', 'nexus-credentials') {
                app.push("${version_tag}")
            }
        }

        stage('Upload nais.yaml to nexus server') {
            dir("${app_name}") {
                  yaml_path = "https://repo.adeo.no/repository/raw/nais/${app_name}/${version_tag}/nais.yaml"
                  sh "curl -s -S --upload-file nais.yaml ${yaml_path}"
            }
        }

        stage('Deploy app to pre-prod nais') {
            sh "curl --fail -k -d '{\"application\": \"${app_name}\", \"version\": \"${version_tag}\", \"skipFasit\": true, \"namespace\": \"${namespace}\", \"manifesturl\": \"${yaml_path}\"}' https://daemon.nais.${test_cluster}/deploy"
        }
    } catch (e) {
        echo "Build failed"
        throw e
    }
}
