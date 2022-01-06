const core = require('@actions/core');
const github = require('@actions/github')
const axios = require('axios');
const FormData = require('form-data');

async function main() {
  
  const release_tag = core.getInput('release-tag');  
  const app_name = core.getInput('application');
  const app_version = core.getInput('version');  
  const app_env = core.getInput('environment');
  
  if (!release_tag || !app_name || !app_version || !app_env) {
    logError("Insufficient/missing arguments...");
    return;
  }

  const octokit = github.getOctokit(GITHUB_TOKEN);
  const { context = {} } = github;
  var is_successful = false;
  var commitSHA = "";

  try {
    const release = await getRelease(octokit, context, release_tag);
    const { id, name } = release.assets.filter(asset => asset.name.includes(release_tag))[0];
    commitSHA = await getCommitSHA(octokit, context, release_tag);
    
    if (commitSHA != ""){
        console.log("sending deployment details to event bridge.");
        await postDeploymentDetails(app_env, app_name, is_successful, app_version, commitSHA, context);
        is_successful = true;
        console.log("action executed successfully.");
    }
  }
  catch (error) {
    logError(error);
  }

  return is_successful;
}

main();

async function postDeploymentDetails(app_env, app_name, is_successful, app_version, commitSHA, context){
	try {		
		const response = await axios({
            method: "post",
            url: `https://api.invitationhomes.com/ci-cd/v1/deployments`,
            headers: {
                'Authorization': `Bearer ${process.env.CI_CD_API_TOKEN}`
            },
            data: { 
                "version": app_version, 
                "commit": commitSHA, 
                "repository": context.repo.repo, 
                "environment": app_env, 
                "isSuccessful": is_successful, 
                "timestamp": new Date().toISOString()
            }
        })
        return response.data;		
	} 
	catch (error) {
		logError(error, false);
	}
}

function logError(error, failWorkflow = true) {
    if (failWorkflow == true) {
        core.setFailed(error.message);      
    } 
    console.error(error);
}
