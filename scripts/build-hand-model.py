"""Optional maintainer tool. Python 3.11 + tflite-support==0.4.4,
flatbuffers==25.2.10 and numpy==2.2.6. Run after npm ci.
Only adds the original graphs' [0,1] input normalization metadata;
weights and inference operators are unchanged. Normal builds use the committed task.
"""
import hashlib, io, json, pathlib, zipfile
import flatbuffers
try:
    from tensorflow_lite_support.metadata import schema_py_generated as schema
    from tensorflow_lite_support.metadata import metadata_schema_py_generated as meta
except ImportError:
    import schema_py_generated as schema
    import metadata_schema_py_generated as meta

root=pathlib.Path(__file__).resolve().parents[1]
source=root/'node_modules/@mediapipe/hands'
sha=lambda b: hashlib.sha256(b).hexdigest()
landmarks=(source/'hand_landmark_full.tflite').read_bytes()
packed=(source/'hands_solution_packed_assets.data').read_bytes()
assert sha(landmarks)=='8c026882c9ec059ce0f8e75266bee5a9a23c341a40e0000df755374d3d1b9b68'
assert sha(packed)=='bdce7b66bfc5b39ba86a47775c98e0b186fe73f8308c2279f852af4c89ffdf42'
palm=packed[11:2341291]
assert sha(palm)=='2f25e740121983f68ffc05f99991d524dc0ea812134f6316a26125816941ee85'

def with_metadata(data,name):
    model=schema.ModelT.InitFromObj(schema.Model.GetRootAsModel(data,0))
    metadata=meta.ModelMetadataT();metadata.name=name;metadata.version='1';metadata.author='Google';metadata.license='Apache-2.0'
    graph=meta.SubGraphMetadataT();image=meta.TensorMetadataT();image.name='image'
    norm=meta.NormalizationOptionsT();norm.mean=[0.0];norm.std=[255.0]
    unit=meta.ProcessUnitT();unit.optionsType=meta.ProcessUnitOptions.NormalizationOptions;unit.options=norm
    image.processUnits=[unit];graph.inputTensorMetadata=[image]
    graph.outputTensorMetadata=[]
    for i in range(len(model.subgraphs[0].outputs)):
        output=meta.TensorMetadataT();output.name=f'output_{i}';graph.outputTensorMetadata.append(output)
    metadata.subgraphMetadata=[graph]
    builder=flatbuffers.Builder(1024);builder.Finish(metadata.Pack(builder),file_identifier=b'M001')
    buf=schema.BufferT();buf.data=bytearray(builder.Output())
    entry=schema.MetadataT();entry.name='TFLITE_METADATA';entry.buffer=len(model.buffers)
    model.buffers.append(buf);model.metadata=list(model.metadata or [])+[entry]
    builder=flatbuffers.Builder(len(data)+4096);builder.Finish(model.Pack(builder),file_identifier=b'TFL3')
    return bytes(builder.Output())

out=io.BytesIO()
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_STORED) as z:
    for name,data in [('hand_detector.tflite',palm),('hand_landmarks_detector.tflite',landmarks)]:
        z.writestr(zipfile.ZipInfo(name,date_time=(1980,1,1,0,0,0)),with_metadata(data,name))
task=out.getvalue();target=root/'public/vision';target.mkdir(parents=True,exist_ok=True)
(target/'hand_landmarker.task').write_bytes(task)
(target/'manifest.json').write_text(json.dumps({'source':'Google @mediapipe/hands@0.4.1675469240 (Apache-2.0)','modification':'Added [0,1] normalization metadata to unchanged official models; bundled for HandLandmarker','sha256':sha(task),'originalModels':{'palm':sha(palm),'landmarks':sha(landmarks)}},indent=2)+'\n')
print('Task SHA-256:',sha(task))
