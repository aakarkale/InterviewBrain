// A static taste of the mind-map: companies, one hot competency, one
// story — edges drawn in by the motion system on scroll.
export function MiniMap() {
  return (
    <div className="l-map-panel" data-map>
      <svg
        className="l-map"
        viewBox="0 0 360 300"
        role="img"
        aria-label="Mind-map preview: a weak competency node connected to three companies and a story"
      >
        <g>
          <path className="edge" data-draw="map" d="M 180 150 Q 120 100 84 84" />
          <path className="edge" data-draw="map" d="M 180 150 Q 240 105 276 92" />
          <path className="edge" data-draw="map" d="M 180 150 Q 130 200 102 222" />
          <path className="edge" data-draw="map" d="M 180 150 Q 235 192 264 212" />
        </g>

        <g data-node>
          <circle className="node node-hot" cx="180" cy="150" r="28" />
          <text className="label-hot" x="180" y="154" textAnchor="middle">
            metrics
          </text>
        </g>

        <g data-node>
          <circle className="node" cx="70" cy="72" r="19" />
          <text x="70" y="42" textAnchor="middle">
            stripe
          </text>
        </g>

        <g data-node>
          <circle className="node" cx="290" cy="80" r="19" />
          <text x="290" y="50" textAnchor="middle">
            figma
          </text>
        </g>

        <g data-node>
          <circle className="node" cx="90" cy="234" r="19" />
          <text x="90" y="268" textAnchor="middle">
            linear
          </text>
        </g>

        <g data-node>
          <circle className="node node-warm" cx="278" cy="224" r="16" />
          <text x="278" y="258" textAnchor="middle">
            story: turnaround
          </text>
        </g>
      </svg>
    </div>
  );
}
