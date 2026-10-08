import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Video, FPS, totalFrames} from './Video.jsx';
import {Promo, PROMO_FRAMES} from './promo/Promo.jsx';

// 时长由传入的文章数据决定（--props=<文章目录>/build/props.json）
// Promo：项目宣传片（固定 60 秒，--props=articles/2026-10-promo-article-to-video/build/promo_props.json）
const Root = () => (
  <>
    <Composition
      id="Video"
      component={Video}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{timeline: {scenes: []}, images: {}, shots: {}, steps: {}, meta: {}}}
      calculateMetadata={({props}) => ({durationInFrames: totalFrames(props)})}
    />
    <Composition id="Promo" component={Promo} fps={FPS} width={1920} height={1080} durationInFrames={PROMO_FRAMES}
      defaultProps={{timeline: null, article: null, scriptExcerpt: [], thumbs: []}} />
  </>
);

registerRoot(Root);
