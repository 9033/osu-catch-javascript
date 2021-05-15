/*
// by vue.js
*/

var fileName = new Vue({//for file name viewer
    el: '#fileName',
    data: {
        filename: 'drag and drop'
    }
});

/*
// attach a file
*/
var osuCTBViewr=new osuCTBView();
var osuData
var fileData;
var files;
function dropFile(e){
    files=e.originalEvent.dataTransfer.files[0];
    fileName.filename=files.name;
    //read osu file
    const reader = new FileReader();
    reader.onload = function(evt) {//read and play
        fileData=evt.target.result;
        document.querySelector("#fileContents").value= fileData;

        let osuFileData=fileData.split('\r\n');
        osuData=readOsu(osuFileData);
        osuCTBViewr.osuEnvInit(osuData);
        osuCTBViewr.readHitObjects(osuData);
        osuCTBViewr.playHitObjects();
    };

    if( /.+\.osu$/.test(files.name) ==true){//check file extension
        reader.readAsText(files);//text
    }
    else {
        fileName.filename+=' is not osu file!!';
    }
}
$('#file').bind('dragenter',function(e){e.stopPropagation();e.preventDefault();});
$('#file').bind('dragover',function(e){e.stopPropagation();e.preventDefault();});
$('#file').bind('drop',function(e){e.stopPropagation();e.preventDefault();dropFile(e);});

function readOsu( osuFileData ){
    let osuData={};
    let idx=0;
    for(;idx<osuFileData.length;idx++){
        let line=osuFileData[idx];
        if( /^osu file format/.test(line) ){//read version of osu file foramt
            osuData['osu file foramt']=/osu file format\s(\w+)/.exec(line)[1];//'v14'
        }
        else if( /^([^:,]+):(.+)$/.test(line) ){//read attributes
            let result=/^(.+):(.+)$/.exec(line);
            osuData[ result[1] ]=result[2];
        }
        else if( /\[.+\]/.test(line) ){//read HitObjects, TimingPoints, Colours, Events
            let result=/\[(.+)\]/.exec(line);
            if( false == ['HitObjects','TimingPoints','Colours','Events'].includes( result[1] ) )
                continue;
            osuData[ result[1] ]=[];
            idx++;
            for(;idx<osuFileData.length;idx++){//read data
                let line=osuFileData[idx];
                if( line.length > 0 ){
                    osuData[ result[1] ].push(line);
                }
                else {
                    break;
                }
            }
        }
    }
    return osuData;
}

let progressBar=document.querySelector('progress');
function updateProgressBar(){
    progressBar.value = osuCTBViewr.getProgress();
}
osuCTBViewr.c.onchange=updateProgressBar;

testVectors=[];
testVectors.push( new vector(110,192) );
testVectors.push( new vector(446,192) );

sp= new SliderPath('L',testVectors);
sp.ensureInitialised();
