// Guard model-version evidence: 1986 materials must not be asserted for 1987.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const model=read('mobot-engineering-v22-model.js');
const passport=JSON.parse(read('mobot-engineering-v22-passport.json'));
const page=read('mobot-engineering-v22.html'),latest=read('mobot-latest.html');
const p=passport.trackProvenance;
assert.equal(passport.revision,'v22');
assert.equal(passport.physicalScaleKnown,false);
assert.equal(p.base1986.polyurethaneTrackLinksMentioned,true);
assert.equal(p.base1986.source,'SKTB-TEXT');
assert.equal(p.modern1987.trackMaterial,null);
assert.equal(p.modern1987.trackMaterialHistoricallyVerified,false);
assert.equal(p.modern1987.balancersGeometryHistoricallyVerified,false);
assert.equal(p.lockReinforcement.implementationOn1987Established,false);
assert.equal(p.reconstruction.linksPerSideHistoricMeasure,false);
assert(model.includes("rubber:mat('Покрытие траков · материал Ч-ХВ-2 не установлен'"));
assert(model.includes("tread.name='Отдельные траки · материал Ч-ХВ-2 не установлен'"));
assert(!model.includes("tread.name='Отдельные полиуретановые траки'"));
assert(model.includes('Полиуретан описан для исходного Ч-ХВ (1986)'));
assert(page.includes('Материал траков Ч-ХВ-2 (1987) не установлен'));
assert(latest.includes('mobot-engineering-v22.html')&&latest.includes('паспорт достоверности'));
assert.equal(passport.sources['SKTB-TEXT'].url,'https://sktbpr.ru/node/23');
assert.equal(passport.sources['BATANOV-2026'].url,'https://storage.arsenal-otechestva.ru/article/2375-chernobylskaya-krysha');
for(const id of p.modern1987.photoSources){
  assert(fs.existsSync(path.join(root,passport.sources[id].local)));
  assert(passport.sources[id].url.startsWith('https://sktbpr.ru/'));
}
// Explicitly exclude later MRK-46M engineering particulars from the 1987 Mobot.
const foreign=passport.crossVariantExclusions;
assert.equal(foreign.comparedWith,'МРК-46М');
assert.equal(foreign.evidenceClassForMobot,'NOT APPLICABLE');
assert.equal(foreign.geometryOfMobotEstablishedByTheseStatements,false);
assert.equal(foreign.prohibitedTransfers.length,4);
assert.deepEqual(foreign.prohibitedTransfers,[
  'six road wheels per side',
  'symmetrical torsion-bar suspension with coupled parallel torsion bars',
  'eight reinforced polyurethane track segments',
  'motor-sprocket transmission'
]);
assert(foreign.source.includes('bnti.ru/showart.asp'));
assert(fs.existsSync(path.join(root,foreign.reference)));

const result={test:'1986-1987-track-evidence-boundary',releasedVersion:'v22',
  polymerProvedFor1986:true,polymerProvedFor1987:false,
  balancersExactSchemeProved:false,trackLocksReinforcedOn1987Proved:false,
  modelDimensionsMeasured:false,localSourcesExist:true,mrk46mAttributionExcluded:true,externalLinksHttpNotTested:true};
if(require.main===module)console.log(JSON.stringify(result,null,2));
module.exports=result;
