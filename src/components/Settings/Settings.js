import React, { memo } from "react";
import PropTypes from "prop-types";

import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import FormGroup from "@material-ui/core/FormGroup";
import Switch from "@material-ui/core/Switch";

import { SETTINGS } from "../../constants/settings";

import "./Settings.css";

const Settings = ({ show, settings, onChange, onClose }) => {
  const toggleSetting = (id) => (event) => {
    onChange({ ...settings, [id]: event.target.checked });
  };

  return (
    <Dialog open={show} onClose={onClose}>
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <div id="settings">
          <FormGroup>
            {SETTINGS.map(({ id, label, description }) => (
              <div className="setting" key={id}>
                <FormControlLabel
                  control={
                    <Switch
                      id={`setting-${id}`}
                      color="primary"
                      checked={!!settings[id]}
                      onChange={toggleSetting(id)}
                    />
                  }
                  label={label}
                />
                <small>{description}</small>
              </div>
            ))}
          </FormGroup>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

Settings.defaultProps = {
  settings: {},
};

Settings.propTypes = {
  show: PropTypes.bool.isRequired,
  settings: PropTypes.shape({}),
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default memo(Settings);
