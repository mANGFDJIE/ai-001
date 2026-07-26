import React from 'react';
import { Container, Typography, Grid, Paper, Button } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

function NearbyServices() {
  return (
    <Container maxWidth="md" style={{ paddingTop: '4rem' }}>
      <Typography variant="h2" style={{ textAlign: 'center' }}>
        Услуги рядом
      </Typography>
      <Grid container spacing={4} style={{ marginTop: '2rem' }}>
        <Grid item xs={12} md={4}>
          <Paper style={{ padding: '2rem' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item>
                <LocationOnIcon
                  style={{ fontSize: '4rem', color: '#2e7d32' }}
                />
              </Grid>
              <Grid item>
                <Typography variant="h4" gutterBottom>
                  haemohd
                </Typography>
                <Typography>
                  Разظامных учим представленыשacqua
                  rivny х д
                  будет
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <!-- Добавьте здесь больше услуг -->
        </Grid>
        <Grid item xs={12} md={4}>
          <!-- Добавьте здесь больше услуг -->
        </Grid>
      </Grid>
      <Button
        variant="contained"
        color="primary"
        style={{ marginTop: '2rem', display: 'block', marginLeft: 'auto', marginRight: 'auto' }}
      >
        Еще услуги
      </Button>
    </Container>
  );
}

export default NearbyServices;
