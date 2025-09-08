import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import Tooltip from '@mui/material/Tooltip';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ReplayIcon from '@mui/icons-material/Replay';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import LastPageIcon from '@mui/icons-material/LastPage';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

export default function ItemAnimation({
  items = [],
  onFrameChange,
  title = 'Timeline',
  initialAutoPlay = false,
  speedMs = 800,
}) {
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const transformRef = useRef(d3.zoomIdentity);
  const [dims, setDims] = useState({ w: 0, h: 60 });
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(initialAutoPlay);
  const timerRef = useRef(null);

  const parsed = useMemo(() => {
    const withDate = items
      .map((f) => {
        const dt = f?.properties?.start_datetime || f?.properties?.datetime;
        return { id: f?.id, date: dt ? new Date(dt) : null, raw: f };
      })
      .filter((x) => x.date && x.raw);
    withDate.sort((a, b) => a.date - b.date);
    return withDate;
  }, [items]);

  const dates = useMemo(() => parsed.map((p) => p.date), [parsed]);

  const baseX = useMemo(() => {
    if (!dates.length || !dims.w) return null;
    const min = d3.min(dates);
    const max = d3.max(dates);
    const pad = 20 * 24 * 3600 * 1000;
    return d3
      .scaleTime()
      .domain([new Date(min.getTime() - pad), new Date(max.getTime() + pad)])
      .range([30, dims.w - 30]);
  }, [dates, dims.w]);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const ro = new ResizeObserver(([e]) =>
      setDims({ w: e.contentRect.width, h: 60 })
    );
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (parsed.length && onFrameChange) onFrameChange(parsed[activeIndex].raw);
  }, [activeIndex, parsed, onFrameChange]);

  useEffect(() => {
    if (!dims.w || !dates.length || !baseX) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', `translate(0, ${dims.h / 2})`);
    const render = (t) => {
      transformRef.current = t;
      g.selectAll('*').remove();
      const x = t.rescaleX(baseX);
      const minDate = d3.min(dates);
      const maxDate = d3.max(dates);
      const months = d3.utcMonths(minDate, maxDate);
      const span = x(maxDate) - x(minDate);
      const ppm = months.length > 1 ? span / months.length : span;
      let ticks = [];
      if (ppm > 55) ticks = d3.utcMonths(minDate, maxDate);
      else if (ppm > 34) ticks = d3.utcMonths(minDate, maxDate, 2);
      else if (ppm > 12) ticks = d3.utcMonths(minDate, maxDate, 6);
      else if (ppm > 4) ticks = d3.utcYears(minDate, maxDate);
      else if (ppm > 2) ticks = d3.utcYears(minDate, maxDate, 2);
      else ticks = d3.utcYears(minDate, maxDate, 5);
      g.selectAll('line.tick')
        .data(ticks)
        .enter()
        .append('line')
        .attr('class', 'tick')
        .attr('x1', (d) => x(d))
        .attr('x2', (d) => x(d))
        .attr('y1', -dims.h * 0.15)
        .attr('y2', dims.h * 0.15)
        .attr('stroke', '#aaa');
      g.append('line')
        .attr('x1', 30)
        .attr('x2', dims.w - 30)
        .attr('stroke', '#d1d5db')
        .attr('stroke-width', 2);
      g.selectAll('text.ticklabel')
        .data(ticks)
        .enter()
        .append('text')
        .attr('class', 'ticklabel')
        .attr('x', (d) => x(d))
        .attr('y', -dims.h * 0.35)
        .attr('text-anchor', 'middle')
        .attr('font-size', 10)
        .attr('fill', '#6b7280')
        .text((d) =>
          ppm > 12 ? d3.utcFormat('%b %Y')(d) : d3.utcFormat('%Y')(d)
        );
      const circles = g
        .selectAll('circle.dot')
        .data(parsed)
        .enter()
        .append('circle')
        .attr('class', 'dot')
        .attr('cx', (d) => x(d.date))
        .attr('cy', 0)
        .attr('r', 5)
        .attr('fill', (d, i) => (i === activeIndex ? '#3b82f6' : '#9ca3af'))
        .style('cursor', 'pointer')
        .on('click', (_, d) => {
          const idx = parsed.findIndex((p) => p.id === d.id);
          setActiveIndex(idx);
        });
      g.selectAll('.active-circle').remove();
      g.append('circle')
        .attr('class', 'active-circle')
        .attr('r', 5)
        .attr('fill', '#3b82f6')
        .attr('cx', x(parsed[activeIndex].date))
        .attr('cy', 0)
        .style('pointer-events', 'none');
      circles
        .append('title')
        .text((d) => d3.utcFormat('%Y-%m-%d %H:%M:%S')(d.date));
    };
    const zoom = d3
      .zoom()
      .scaleExtent([1, 40])
      .translateExtent([
        [30, 0],
        [dims.w - 30, 0],
      ])
      .extent([
        [30, 0],
        [dims.w - 30, 0],
      ])
      .on('zoom', (e) => render(e.transform));
    zoomRef.current = zoom;
    svg.call(zoom);
    render(d3.zoomIdentity);
    const center = () => {
      const svgNode = svgRef.current;
      if (!svgNode) return;
      const x = baseX(parsed[activeIndex].date);
      const mid = (dims.w - 60) / 2 + 30;
      const tx = Math.max(
        (dims.w - 30) * (1 - 1),
        Math.min(30 * (1 - 1), mid - x)
      );
      const t = d3.zoomIdentity.translate(tx, 0).scale(1);
      d3.select(svgNode)
        .transition()
        .duration(250)
        .call(zoomRef.current.transform, t);
    };
    center();
  }, [dims, parsed, activeIndex, baseX, dates]);

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = setInterval(() => {
      setActiveIndex((i) => {
        const next = i + 1;
        if (next >= parsed.length) return 0;
        return next;
      });
    }, speedMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, speedMs, parsed.length]);

  const move = (dir) => {
    if (!parsed.length) return;
    if (dir === 'first') setActiveIndex(0);
    else if (dir === 'last') setActiveIndex(parsed.length - 1);
    else if (dir === 'left') setActiveIndex((i) => Math.max(0, i - 1));
    else if (dir === 'right')
      setActiveIndex((i) => Math.min(parsed.length - 1, i + 1));
  };

  const reset = () => {
    const svg = d3.select(svgRef.current);
    svg
      .transition()
      .duration(250)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  };

  const fmt = d3.utcFormat('%Y-%m-%d %H:%M');

  return (
    <Box sx={{ width: '100%', p: 1 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 0.5,
        }}
      >
        <Typography variant='subtitle2'>{title}</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title='Reset'>
            <IconButton size='small' onClick={reset}>
              <ReplayIcon fontSize='small' />
            </IconButton>
          </Tooltip>
          <Tooltip title='First'>
            <IconButton size='small' onClick={() => move('first')}>
              <FirstPageIcon fontSize='small' />
            </IconButton>
          </Tooltip>
          <Tooltip title='Prev'>
            <IconButton size='small' onClick={() => move('left')}>
              <KeyboardArrowLeftIcon fontSize='small' />
            </IconButton>
          </Tooltip>
          <Tooltip title={playing ? 'Pause' : 'Play'}>
            <IconButton size='small' onClick={() => setPlaying((p) => !p)}>
              {playing ? (
                <PauseIcon fontSize='small' />
              ) : (
                <PlayArrowIcon fontSize='small' />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title='Next'>
            <IconButton size='small' onClick={() => move('right')}>
              <KeyboardArrowRightIcon fontSize='small' />
            </IconButton>
          </Tooltip>
          <Tooltip title='Last'>
            <IconButton size='small' onClick={() => move('last')}>
              <LastPageIcon fontSize='small' />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <div ref={containerRef} style={{ width: '100%' }}>
        <svg ref={svgRef} width={dims.w} height={dims.h} />
      </div>
      {parsed.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Box>
            <Typography variant='caption'>Start</Typography>
            <Typography variant='subtitle2'>{fmt(parsed[0].date)}</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant='caption'>Active</Typography>
            <Typography variant='subtitle2'>
              {fmt(parsed[activeIndex].date)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant='caption'>End</Typography>
            <Typography variant='subtitle2'>
              {fmt(parsed[parsed.length - 1].date)}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
