"""
Chordly - Flask Backend
Serves the web UI and provides API endpoints for MusicXML/MIDI export.
"""
import io
import json
import os
from flask import Flask, render_template, request, send_file, jsonify
import app.chord_engine as chord_engine

app = Flask(__name__,
            template_folder='templates',
            static_folder='static')
app.config['TEMPLATES_AUTO_RELOAD'] = True

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
os.makedirs(DATA_DIR, exist_ok=True)


@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


@app.route('/')
def index():
    """Serve the main single-page application."""
    return render_template('index.html')


@app.route('/manifest.json')
def serve_manifest():
    return send_file(os.path.join(app.static_folder, 'manifest.json'), mimetype='application/manifest+json')


@app.route('/sw.js')
def serve_sw():
    response = send_file(os.path.join(app.static_folder, 'sw.js'), mimetype='application/javascript')
    response.headers['Service-Worker-Allowed'] = '/'
    return response


@app.route('/api/export/musicxml', methods=['POST'])
def export_musicxml():
    """Generate and return a MusicXML file from chord progression data."""
    try:
        song_data = request.get_json()
        if not song_data:
            return jsonify({'error': 'No data provided'}), 400

        xml_bytes = chord_engine.generate_musicxml(song_data)
        buffer = io.BytesIO(xml_bytes)
        buffer.seek(0)

        title = song_data.get('title', 'chordly_export')
        safe_title = "".join(c for c in title if c.isalnum() or c in ('_', '-')).rstrip()
        filename = f"{safe_title or 'chordly_export'}.musicxml"

        return send_file(
            buffer,
            mimetype='application/vnd.recordare.musicxml+xml',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/export/midi', methods=['POST'])
def export_midi():
    """Generate and return a MIDI file from chord progression data."""
    try:
        song_data = request.get_json()
        if not song_data:
            return jsonify({'error': 'No data provided'}), 400

        midi_bytes = chord_engine.generate_midi(song_data)
        buffer = io.BytesIO(midi_bytes)
        buffer.seek(0)

        title = song_data.get('title', 'chordly_export')
        safe_title = "".join(c for c in title if c.isalnum() or c in ('_', '-')).rstrip()
        filename = f"{safe_title or 'chordly_export'}.mid"

        return send_file(
            buffer,
            mimetype='audio/midi',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
