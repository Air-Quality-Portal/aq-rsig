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
  speedMs = 2000,
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

  // Detect time interval and create appropriate formatters
  const { timeInterval, formatters } = useMemo(() => {
    if (!parsed.length) {
      return {
        timeInterval: 'unknown',
        formatters: {
          main: d3.utcFormat('%Y-%m-%d'),
          tooltip: d3.utcFormat('%Y-%m-%d %H:%M:%S'),
          tick: d3.utcFormat('%Y')
        }
      };
    }

    // Try to get time interval from dataset metadata
    const firstItem = parsed[0].raw;
    let detectedInterval = firstItem?.properties?.dataset_type 
      ? getTimeIntervalFromDataset(firstItem.properties)
      : null;

    // If not available from metadata, infer from date patterns
    if (!detectedInterval && parsed.length > 1) {
      detectedInterval = inferTimeInterval(parsed);
    }

    // Fallback to daily if can't determine
    detectedInterval = detectedInterval || 'daily';

    const formatters = createFormatters(detectedInterval);
    
    return {
      timeInterval: detectedInterval,
      formatters
    };
  }, [parsed]);

  // Helper function to get time interval from dataset properties
  function getTimeIntervalFromDataset(properties) {
    // This would come from your dataset metadata
    // You might need to pass this as a prop or derive it from your data
    return null; // For now, let inference handle it
  }

  // Helper function to infer time interval from date patterns
  function inferTimeInterval(parsedData) {
    if (parsedData.length < 2) return 'daily';

    const firstDate = parsedData[0].date;
    const secondDate = parsedData[1].date;
    const diffMs = Math.abs(secondDate - firstDate);
    
    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs; // Approximate

    if (diffMs <= hourMs * 2) {
      return 'hourly';
    } else if (diffMs <= dayMs * 2) {
      return 'daily';
    } else if (diffMs <= weekMs * 2) {
      return 'weekly';
    } else if (diffMs <= monthMs * 2) {
      return 'monthly';
    } else {
      return 'yearly';
    }
  }

  // Helper function to create formatters based on time interval
  function createFormatters(interval) {
    switch (interval.toLowerCase()) {
      case 'hourly':
        return {
          main: d3.utcFormat('%Y-%m-%d %H:00'),
          tooltip: d3.utcFormat('%Y-%m-%d %H:00 UTC'),
          tick: d3.utcFormat('%H:00'),
          tickLong: d3.utcFormat('%m/%d %H:00')
        };
      
      case 'daily':
        return {
          main: d3.utcFormat('%Y-%m-%d'),
          tooltip: d3.utcFormat('%Y-%m-%d'),
          tick: d3.utcFormat('%m/%d'),
          tickLong: d3.utcFormat('%Y-%m-%d')
        };
      
      case 'weekly':
        return {
          main: d3.utcFormat('%Y-%m-%d'),
          tooltip: d3.utcFormat('Week of %Y-%m-%d'),
          tick: d3.utcFormat('%m/%d'),
          tickLong: d3.utcFormat('%Y-%m-%d')
        };
      
      case 'monthly':
        return {
          main: d3.utcFormat('%Y-%m'),
          tooltip: d3.utcFormat('%B %Y'),
          tick: d3.utcFormat('%b'),
          tickLong: d3.utcFormat('%b %Y')
        };
      
      case 'yearly':
        return {
          main: d3.utcFormat('%Y'),
          tooltip: d3.utcFormat('%Y'),
          tick: d3.utcFormat('%Y'),
          tickLong: d3.utcFormat('%Y')
        };
      
      default:
        return {
          main: d3.utcFormat('%Y-%m-%d'),
          tooltip: d3.utcFormat('%Y-%m-%d %H:%M:%S'),
          tick: d3.utcFormat('%Y'),
          tickLong: d3.utcFormat('%Y-%m-%d')
        };
    }
  }

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
      
      // Determine appropriate ticks based on time interval and zoom level
      let ticks = [];
      const span = x(maxDate) - x(minDate);
      
      if (timeInterval === 'hourly') {
        const hours = d3.utcHours(minDate, maxDate);
        const pph = hours.length > 1 ? span / hours.length : span;
        if (pph > 50) ticks = d3.utcHours(minDate, maxDate);
        else if (pph > 25) ticks = d3.utcHours(minDate, maxDate, 2);
        else if (pph > 12) ticks = d3.utcHours(minDate, maxDate, 6);
        else ticks = d3.utcDays(minDate, maxDate);
      } else if (timeInterval === 'daily') {
        const days = d3.utcDays(minDate, maxDate);
        const ppd = days.length > 1 ? span / days.length : span;
        if (ppd > 40) ticks = d3.utcDays(minDate, maxDate);
        else if (ppd > 20) ticks = d3.utcDays(minDate, maxDate, 7);
        else ticks = d3.utcMonths(minDate, maxDate);
      } else if (timeInterval === 'monthly') {
        const months = d3.utcMonths(minDate, maxDate);
        const ppm = months.length > 1 ? span / months.length : span;
        if (ppm > 55) ticks = d3.utcMonths(minDate, maxDate);
        else if (ppm > 34) ticks = d3.utcMonths(minDate, maxDate, 2);
        else if (ppm > 12) ticks = d3.utcMonths(minDate, maxDate, 6);
        else if (ppm > 4) ticks = d3.utcYears(minDate, maxDate);
        else ticks = d3.utcYears(minDate, maxDate, 2);
      } else {
        // Yearly or fallback
        const years = d3.utcYears(minDate, maxDate);
        const ppy = years.length > 1 ? span / years.length : span;
        if (ppy > 40) ticks = d3.utcYears(minDate, maxDate);
        else if (ppy > 20) ticks = d3.utcYears(minDate, maxDate, 2);
        else ticks = d3.utcYears(minDate, maxDate, 5);
      }

      // Timeline baseline
      g.append("line")
        .attr("x1", 30)
        .attr("x2", dims.w - 30)
        .attr("stroke", "#e5e7eb")
        .attr("stroke-width", 4);

      // Grid/tick lines
      g.selectAll("line.tick")
        .data(ticks)
        .enter()
        .append("line")
        .attr("class", "tick")
        .attr("x1", (d) => x(d))
        .attr("x2", (d) => x(d))
        .attr("y1", -dims.h * 0.25)
        .attr("y2", dims.h * 0.25)
        .attr("stroke", "#d1d5db")
        .attr("stroke-dasharray", "2,2");

      // Tick labels with interval-appropriate formatting
      g.selectAll("text.ticklabel")
        .data(ticks)
        .enter()
        .append("text")
        .attr("class", "ticklabel")
        .attr("x", (d) => x(d))
        .attr("y", -dims.h * 0.35)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("font-weight", 500)
        .attr("fill", "#374151")
        .text((d) => {
          const tickSpan = ticks.length > 1 ? span / ticks.length : span;
          return tickSpan > 50 ? formatters.tickLong(d) : formatters.tick(d);
        });

      // Circles (dots)
      const circles = g
        .selectAll("circle.dot")
        .data(parsed)
        .enter()
        .append("circle")
        .attr("class", "dot")
        .attr("cx", (d) => x(d.date))
        .attr("cy", 0)
        .attr("r", 4)
        .attr("fill", (d, i) =>
          i === activeIndex ? "#34495E" : "#9ca3af"
        )
        .attr("stroke", (d, i) => (i === activeIndex ? "#34495E" : "none"))
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .on("click", (_, d) => {
          const idx = parsed.findIndex((p) => p.id === d.id);
          setActiveIndex(idx);
        });

      // Highlighted active circle overlay
      g.selectAll(".active-circle").remove();
      g.append("circle")
        .attr("class", "active-circle")
        .attr("r", 6)
        .attr("fill", "#34495E")
        .attr("stroke", "#34495E")
        .attr("stroke-width", 2)
        .attr("cx", x(parsed[activeIndex].date))
        .attr("cy", 0)
        .style("pointer-events", "none");

      // Tooltip with interval-appropriate formatting
      circles
        .append("title")
        .text((d) => formatters.tooltip(d.date));
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
  }, [dims, parsed, activeIndex, baseX, dates, timeInterval, formatters]);

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

  return (
    <Box sx={{ width: '100%', p: 1 }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column", 
          alignItems: "flex-start", 
          gap: 1,
          mb: 0.5,
          alignItems: "center",
          justifyContent: "center",
          width: "100%",  
        }}
      >
        <Typography variant="subtitle2">
          {title} {timeInterval !== 'unknown' && (
            <span style={{ fontSize: '0.8em', color: '#666', fontWeight: 'normal' }}>
              ({timeInterval})
            </span>
          )}
        </Typography>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          <Tooltip title="Reset">
            <IconButton size="small" onClick={reset}>
              <ReplayIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="First">
            <IconButton size="small" onClick={() => move("first")}>
              <FirstPageIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Prev">
            <IconButton size="small" onClick={() => move("left")}>
              <KeyboardArrowLeftIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={playing ? "Pause" : "Play"}>
            <IconButton size="small" onClick={() => setPlaying((p) => !p)}>
              {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Next">
            <IconButton size="small" onClick={() => move("right")}>
              <KeyboardArrowRightIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Last">
            <IconButton size="small" onClick={() => move("last")}>
              <LastPageIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <div ref={containerRef} style={{ width: '100%' }}>
        <svg ref={svgRef} width={dims.w} height={dims.h} />
      </div>
      {parsed.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            mt: 1,
            px: 1,
            py: 0.5,
            bgcolor: '#fff',
            borderRadius: 1,
            boxShadow: '0 1px 1px rgba(0,0,0,0.0)',
            height: 45,
          }}
        >
          {/* Start */}
          <Box sx={{ textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 60 }}>
            <Typography variant='caption' color='text.secondary' sx={{ fontSize: 10 }}>Start</Typography>
            <Typography variant='subtitle2' sx={{ fontSize: 11 }}>
              {formatters.main(parsed[0].date)}
            </Typography>
          </Box>

          {/* Active */}
          <Box
            sx={{
              flex: 1,
              mx: 1,
              bgcolor: '#34495E',
              color: 'white',
              borderRadius: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: 11,
            }}
          >
            <Typography variant='caption' sx={{ fontSize: 10, opacity: 0.8 }}>Active</Typography>
            <Typography variant='subtitle2' sx={{ fontSize: 11, fontWeight: 500 }}>
              {formatters.main(parsed[activeIndex].date)}
            </Typography>
          </Box>

          {/* End */}
          <Box sx={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 60 }}>
            <Typography variant='caption' color='text.secondary' sx={{ fontSize: 10 }}>End</Typography>
            <Typography variant='subtitle2' sx={{ fontSize: 11 }}>
              {formatters.main(parsed[parsed.length - 1].date)}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}